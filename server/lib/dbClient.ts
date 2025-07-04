/**
 * CENTRALIZED DATABASE CLIENT
 * Single source of truth for database connections across the application
 * Prevents inconsistent imports between db/pool references
 */

export { db, pool } from '../db';