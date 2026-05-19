declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: DatabaseStatic;
  }

  export interface DatabaseStatic {
    new (data?: Buffer | Uint8Array | null): Database;
  }

  export interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): QueryReturn[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    bind(params?: unknown[]): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    get(): unknown[];
    free(): void;
    reset(): void;
  }

  export interface QueryReturn {
    columns: string[];
    values: unknown[][];
  }

  export default function initSqlJs(config?: { locateFile?: (path: string) => string }): Promise<SqlJsStatic>;
}
