import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

// ─── Domain interfaces ──────────────────────────────────────────────────────

export interface MetricConfig {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  dataSource: 'auto' | 'manual';
  sqlQuery?: string;
  scoreFormula?: string;
  evidenceColumns?: string[];
  evidenceType: 'quantitative' | 'qualitative' | 'mixed';
  edaiNote?: string;
}

export interface CriterionConfig {
  id: string;
  name: string;
  weightage: number;
  metrics: MetricConfig[];
}

export interface InstitutionConfig {
  name: string;
  shortName: string;
  affiliation: string;
  city: string;
  state: string;
  type: string;
  naacGradeThresholds: Record<string, number>;
}

export interface MetricsConfig {
  institution: InstitutionConfig;
  criteria: CriterionConfig[];
}

export interface MetricResult {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  earnedScore: number | null;
  dataSource: 'auto' | 'manual';
  status: 'OK' | 'MANUAL' | 'ERROR';
  liveData: Record<string, unknown> | null;
  evidenceType: string;
  edaiNote?: string;
}

export interface CriterionResult {
  id: string;
  name: string;
  weightage: number;
  maxScore: number;
  earnedScore: number;
  weightedScore: number;
  metrics: MetricResult[];
}

export interface NaacDashboard {
  institution: InstitutionConfig;
  predictedCgpa: number;
  predictedGrade: string;
  generatedAt: string;
  criteria: CriterionResult[];
  summary: {
    totalWeightage: number;
    autoMetrics: number;
    manualMetrics: number;
    errorMetrics: number;
  };
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class NaacService {
  private readonly logger = new Logger(NaacService.name);
  private readonly config: MetricsConfig;

  constructor(
    @Optional() @InjectDataSource() private readonly db: DataSource | null,
  ) {
    const configPath = path.join(__dirname, 'naac-metrics.json');
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as MetricsConfig;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async getDashboard(): Promise<NaacDashboard> {
    const criteriaResults = await Promise.all(
      this.config.criteria.map(c => this.computeCriterion(c)),
    );

    const totalWeightage = criteriaResults.reduce((sum, c) => sum + c.weightage, 0);
    const weightedScoreSum = criteriaResults.reduce((sum, c) => sum + c.weightedScore, 0);

    // Weighted average mapped to 4.0 scale
    const predictedCgpa = totalWeightage > 0
      ? Math.round((weightedScoreSum / totalWeightage) * 4.0 * 100) / 100
      : 0;

    const allMetrics = criteriaResults.flatMap(c => c.metrics);

    return {
      institution: this.config.institution,
      predictedCgpa,
      predictedGrade: this.cgpaToGrade(predictedCgpa),
      generatedAt: new Date().toISOString(),
      criteria: criteriaResults,
      summary: {
        totalWeightage,
        autoMetrics: allMetrics.filter(m => m.status === 'OK').length,
        manualMetrics: allMetrics.filter(m => m.status === 'MANUAL').length,
        errorMetrics: allMetrics.filter(m => m.status === 'ERROR').length,
      },
    };
  }

  getCriterionConfig(criterionId: string): CriterionConfig | undefined {
    return this.config.criteria.find(c => c.id === criterionId);
  }

  getAllCriteria(): CriterionConfig[] {
    return this.config.criteria;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async computeCriterion(criterion: CriterionConfig): Promise<CriterionResult> {
    const metricResults = await Promise.all(
      criterion.metrics.map(m => this.computeMetric(m)),
    );

    const maxScore = metricResults.reduce((sum, m) => sum + m.maxScore, 0);
    const earnedScore = metricResults.reduce((sum, m) => sum + (m.earnedScore ?? 0), 0);

    // Weighted score as percentage of max (0–100), scaled by criterion weightage
    const pctEarned = maxScore > 0 ? earnedScore / maxScore : 0;
    const weightedScore = Math.round(pctEarned * criterion.weightage * 100) / 100;

    return {
      id: criterion.id,
      name: criterion.name,
      weightage: criterion.weightage,
      maxScore,
      earnedScore: Math.round(earnedScore * 100) / 100,
      weightedScore,
      metrics: metricResults,
    };
  }

  async computeMetric(metric: MetricConfig): Promise<MetricResult> {
    // Manual metric: estimate 70% of maxScore for prediction
    if (metric.dataSource === 'manual') {
      return {
        id: metric.id,
        name: metric.name,
        description: metric.description,
        maxScore: metric.maxScore,
        earnedScore: Math.round(metric.maxScore * 0.7 * 100) / 100,
        dataSource: 'manual',
        status: 'MANUAL',
        liveData: null,
        evidenceType: metric.evidenceType,
        ...(metric.edaiNote ? { edaiNote: metric.edaiNote } : {}),
      };
    }

    // Auto metric: run SQL
    if (!this.db) {
      return {
        id: metric.id,
        name: metric.name,
        description: metric.description,
        maxScore: metric.maxScore,
        earnedScore: null,
        dataSource: 'auto',
        status: 'ERROR',
        liveData: null,
        evidenceType: metric.evidenceType,
        ...(metric.edaiNote ? { edaiNote: metric.edaiNote } : {}),
      };
    }

    try {
      const rows = await this.db.query(metric.sqlQuery!);
      const row = (rows[0] ?? {}) as Record<string, unknown>;
      const liveData = this.numericifyRow(row);

      const earnedScore = this.evalScoreFormula(metric.scoreFormula, liveData, metric.maxScore);

      return {
        id: metric.id,
        name: metric.name,
        description: metric.description,
        maxScore: metric.maxScore,
        earnedScore,
        dataSource: 'auto',
        status: 'OK',
        liveData,
        evidenceType: metric.evidenceType,
        ...(metric.edaiNote ? { edaiNote: metric.edaiNote } : {}),
      };
    } catch (err) {
      this.logger.warn(
        `[NAAC] Metric ${metric.id} query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        id: metric.id,
        name: metric.name,
        description: metric.description,
        maxScore: metric.maxScore,
        earnedScore: null,
        dataSource: 'auto',
        status: 'ERROR',
        liveData: null,
        evidenceType: metric.evidenceType,
        ...(metric.edaiNote ? { edaiNote: metric.edaiNote } : {}),
      };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private numericifyRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      const n = Number(v);
      out[k] = !isNaN(n) && v !== null && v !== '' ? n : v;
    }
    return out;
  }

  private evalScoreFormula(
    formula: string | undefined,
    data: Record<string, unknown>,
    maxScore: number,
  ): number {
    if (!formula) return Math.round(maxScore * 0.7 * 100) / 100;

    try {
      // Extract named variables from data — pct, ratio, etc.
      const varNames = Object.keys(data);
      const varValues = varNames.map(k => data[k]);

      // Safe eval: new Function with only the extracted numeric values
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(...varNames, `return (${formula});`) as (...args: unknown[]) => unknown;
      const result = fn(...varValues);
      const score = Number(result);

      if (isNaN(score)) return Math.round(maxScore * 0.7 * 100) / 100;
      return Math.min(Math.max(Math.round(score * 100) / 100, 0), maxScore);
    } catch {
      return Math.round(maxScore * 0.7 * 100) / 100;
    }
  }

  cgpaToGrade(cgpa: number): string {
    const thresholds = this.config.institution.naacGradeThresholds;
    if (cgpa >= thresholds['A++']) return 'A++';
    if (cgpa >= thresholds['A+']) return 'A+';
    if (cgpa >= thresholds['A']) return 'A';
    if (cgpa >= thresholds['B++']) return 'B++';
    if (cgpa >= thresholds['B+']) return 'B+';
    if (cgpa >= thresholds['B']) return 'B';
    if (cgpa >= thresholds['C']) return 'C';
    return 'D';
  }
}
