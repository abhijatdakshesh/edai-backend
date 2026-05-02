import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override columnName(propertyName: string, customName: string | undefined): string {
    return customName ?? toSnake(propertyName);
  }
}
