import { Router } from 'express'

export const createNewsRouter = ({ service } = {}) => {
  if (!service) throw new Error('News router requires a service')
  const router = Router()

  router.get('/sources', (_req, res) => {
    res.json({ sources: service.getSources() })
  })

  router.get('/source', async (req, res) => {
    try {
      const id = typeof req.query.id === 'string' ? req.query.id : ''
      const latest = req.query.latest !== undefined && req.query.latest !== 'false'
      res.json(await service.getSource({ id, latest }))
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message || 'Failed to load news source' })
    }
  })

  router.post('/refresh', async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => typeof id === 'string') : undefined
      res.json(await service.refreshSources(ids))
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to refresh news sources' })
    }
  })

  return router
}
