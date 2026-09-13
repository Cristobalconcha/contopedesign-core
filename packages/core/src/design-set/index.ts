/**
 * DesignSet — ficha C2 (borrador, spec sin auditar: spec-c2-designset-2026-08-31.md).
 *
 * La hoja de respuestas que resuelve un RequirementManifest (C1): para cada
 * requisito activo, la definición efectiva que lo resuelve. Contrato canónico
 * C1 (RequirementManifest) → C2 (DesignSet, aquí) → C3 (EditContext) → C4/C5.
 */
export * from './types.js';
export * from './adapter.js';
export * from './persistence.js';
export * from './project-to-designruleset.js';
