const express = require('express')
const fs = require('fs')
const path = require('path')

const server = express()

let db = {}
try {
  db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.json'), 'utf-8'))
} catch (_) {
  db = { users: [], products: [], categories: [], orders: [] }
}

server.use(express.json())

server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

server.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

server.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  const user = db.users.find((u) => u.username === username && u.password === password)
  if (!user) return res.status(401).json({ message: '用户名或密码错误' })
  const { password: _, ...safeUser } = user
  res.json({ token: 'mock-jwt-token-' + user.id, user: safeUser })
})

server.get('/api/auth/userinfo', (req, res) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ message: '未登录' })
  const id = auth.replace('Bearer mock-jwt-token-', '')
  const user = db.users.find((u) => u.id === Number(id))
  if (!user) return res.status(401).json({ message: '用户不存在' })
  const { password: _, ...safeUser } = user
  res.json({ user: safeUser })
})

server.put('/api/auth/profile', (req, res) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ message: '未登录' })
  const id = auth.replace('Bearer mock-jwt-token-', '')
  const idx = db.users.findIndex((u) => u.id === Number(id))
  if (idx === -1) return res.status(401).json({ message: '用户不存在' })
  const { password, ...rest } = req.body
  Object.assign(db.users[idx], rest)
  if (password) db.users[idx].password = password
  const { password: _, ...safeUser } = db.users[idx]
  res.json({ user: safeUser })
})

server.get('/api/dashboard/stats', (req, res) => {
  const userCount = db.users.length
  const productCount = db.products.length
  const orderCount = db.orders.length
  const activeUsers = db.users.filter((u) => u.status === 'active').length
  const totalRevenue = db.orders.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0)
  const pendingOrders = db.orders.filter((o) => o.status === 'pending').length
  const lowStock = db.products.filter((p) => p.stock > 0 && p.stock < 20).length
  res.json({ userCount, productCount, orderCount, activeUsers, totalRevenue, pendingOrders, lowStock })
})

server.get('/api/dashboard/activities', (req, res) => {
  const activities = []
  db.users.slice(-5).reverse().forEach((u) => {
    activities.push({ type: '新增用户', content: `用户「${u.username}」已注册`, time: u.createdAt })
  })
  db.orders.slice(-5).reverse().forEach((o) => {
    const statusMap = { pending: '待处理', shipped: '已发货', completed: '已完成', cancelled: '已取消' }
    activities.push({ type: '新订单', content: `订单 #${o.id} - ${o.userName} (${statusMap[o.status] || o.status})`, time: o.createdAt })
  })
  db.products.slice(-3).reverse().forEach((p) => {
    activities.push({ type: '产品更新', content: `产品「${p.name}」信息已更新`, time: p.createdAt || p.updatedAt })
  })
  activities.sort((a, b) => (b.time || '').localeCompare(a.time || ''))
  res.json(activities.slice(0, 10))
})

server.get('/api/dashboard/revenue', (req, res) => {
  const monthMap = {}
  db.orders.filter((o) => o.status === 'completed').forEach((o) => {
    const m = (o.createdAt || '').slice(0, 7)
    if (m) monthMap[m] = (monthMap[m] || 0) + o.total
  })
  const months = Object.keys(monthMap).sort()
  res.json({ months, values: months.map((m) => monthMap[m]) })
})

function paginatedList(data, query) {
  const keyword = query.keyword
  let filtered = data
  if (keyword) {
    const kw = keyword.toLowerCase()
    filtered = data.filter((item) =>
      Object.values(item).some((v) => String(v).toLowerCase().includes(kw))
    )
  }
  const total = filtered.length
  const page = Number(query.page) || 1
  const pageSize = Number(query.pageSize) || 20
  const start = (page - 1) * pageSize
  return { list: filtered.slice(start, start + pageSize), total }
}

server.get('/api/users', (req, res) => res.json(paginatedList(db.users, req.query)))
server.get('/api/products', (req, res) => res.json(paginatedList(db.products, req.query)))
server.get('/api/categories', (req, res) => res.json(paginatedList(db.categories, req.query)))
server.get('/api/orders', (req, res) => res.json(paginatedList(db.orders, req.query)))

server.get('/api/users/:id', (req, res) => {
  const item = db.users.find((i) => i.id === Number(req.params.id))
  item ? res.json(item) : res.status(404).json({ message: '未找到' })
})
server.get('/api/products/:id', (req, res) => {
  const item = db.products.find((i) => i.id === Number(req.params.id))
  item ? res.json(item) : res.status(404).json({ message: '未找到' })
})
server.get('/api/categories/:id', (req, res) => {
  const item = db.categories.find((i) => i.id === Number(req.params.id))
  item ? res.json(item) : res.status(404).json({ message: '未找到' })
})
server.get('/api/orders/:id', (req, res) => {
  const item = db.orders.find((i) => i.id === Number(req.params.id))
  item ? res.json(item) : res.status(404).json({ message: '未找到' })
})

module.exports = server
