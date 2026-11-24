export declare const CHECK_EVERY_MS: number;
export declare const IDLE_MS: number;
export declare function quietMoment(input: { hidden: boolean; lastInputAt: number; now: number; idleMs?: number }): boolean;
export declare function registerWithAutoUpdate(swUrl?: string, win?: unknown): Promise<unknown> | null;
