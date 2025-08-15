import { Router } from 'express'

export const tokenRoutes = Router()

tokenRoutes.get('/health', (_req, res) => res.json({ ok: true }))
