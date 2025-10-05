import { defineConfig } from 'vite'

const ipRequests = new Map() // IP -> { count, lastReset, blockedUntil }

export default defineConfig({
  server: {
    port: 3000
  },
  plugins: [
    {
      name: 'connection-logger',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const ip = req.socket.remoteAddress
          const now = Date.now()

          // on ignore les fichiers statiques
          if (!(req.url === '/' || req.url.startsWith('/index'))) {
            return next()
          }

          const time = new Date().toLocaleString()
          let data = ipRequests.get(ip)

          // initialisation
          if (!data) {
            data = { count: 0, lastReset: now, blockedUntil: 0 }
            ipRequests.set(ip, data)
          }

          // reset du compteur toutes les 60 secondes
          if (now - data.lastReset > 60_000) {
            data.count = 0
            data.lastReset = now
          }

          // vérifie si l'IP est bloquée
          if (now < data.blockedUntil) {
            res.statusCode = 403
            return res.end('403 - Trop de requêtes')
          }

          // incrémente le compteur
          data.count++

          // log normal
          console.log(`[${time}] [ INFO ] Nouvelle connexion depuis ${ip} (${data.count}/min)`)

          // si plus de 120 requêtes en 1 minute → blocage 1 min
          if (data.count > 120) {
            data.blockedUntil = now + 1 * 60_000
            console.warn(`[${time}] [ALERT] ⚠️ IP ${ip} bloquée pendant 10 minutes (trop de pings)`)
            res.statusCode = 403
            return res.end('403 - Trop de requêtes, réessayez plus tard.')
          }

          next()
        })
      }
    }
  ]
})
