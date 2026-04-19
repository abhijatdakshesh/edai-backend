import { IsIn, IsNumber, IsString, Max, Min } from 'class-validator';

export class EnterMarksDto {
  @IsString()
  studentId!: string;

  @IsString()
  courseId!: string;

  @IsString()
  institutionId!: string;

  @IsIn(['CIE1', 'CIE2', 'SEE', 'ASSIGNMENT', 'LAB'])
  examType!: string;

  @IsNumber()
  @Min(0)
  maxMarks!: number;

  @IsNumber()
  @Min(0)
  marksObtained!: number;

  @IsString()
  enteredBy!: string;
}

export class VerifyMarksDto {
  @IsString()
  markId!: string;

  @IsString()
  verifiedBy!: string;
}
