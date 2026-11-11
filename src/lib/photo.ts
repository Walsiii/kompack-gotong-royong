import type { Category } from './types'
import before from '../assets/demo-before.png'
import after from '../assets/demo-after.png'

/**
 * Generated photographic examples for the explicitly labelled demo workflow.
 * They are never camera evidence: every consumer retains the sample flag.
 * Versioned local assets work in the web, PWA, Capacitor and Tauri bundles.
 */
export function demoPhoto(kind: 'before' | 'after', _cat: Category, _v = 0): string {
  return kind === 'before' ? before : after
}
