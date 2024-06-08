const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()

app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

console.log(dbPath)

let db = undefined

const startDbServer = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  })
}

startDbServer()

const authenticate = (req, res, next) => {
  if (req.headers.authorization) {
    const jwtToken = req.headers.authorization.split(' ')[1]
    jwt.verify(jwtToken, 'PRIVATE_KEY', (err, payLoad) => {
      if (err) {
        res.status(401)
        res.send('Invalid JWT Token')
      } else {
        req.jwtToken = jwtToken
        next()
      }
    })
  } else {
    res.status(401)
    res.send('Invalid JWT Token')
  }
}

app.get('/', async (req, res) => {
  res.send(await db.all('select * from district'))
})

app.post('/login/', async (req, res) => {
  const dbUser = await db.get(
    `select * from user where username = '${req.body.username}'`,
  )

  if (dbUser === undefined) {
    res.status(400)
    res.send('Invalid user')
  } else {
    const isValidUser = await bcrypt.compare(req.body.password, dbUser.password)
    if (isValidUser) {
      /*code to generate access token*/
      const payLoad = {username: dbUser.username}
      const jwtToken = jwt.sign(payLoad, 'PRIVATE_KEY')
      res.send({jwtToken: jwtToken})
    } else {
      res.status(400)
      res.send('Invalid password')
    }
  }
})

app.get('/states/', authenticate, async (req, res) => {
  let result = await db.all(`select * from state`)
  result = result.map(obj => {
    return {
      stateId: obj.state_id,
      stateName: obj.state_name,
      population: obj.population,
    }
  })
  res.send(result)
})

app.get('/states/:stateId/', authenticate, async (req, res) => {
  const {stateId} = req.params
  console.log(`select * from state where state_id = ${stateId}`)
  const result = await db.get(`select * from state where state_id = ${stateId}`)
  res.send({
    stateId: result.state_id,
    stateName: result.state_name,
    population: result.population,
  })
})

app.post('/districts/', authenticate, async (req, res) => {
  const districtId =
    (await db.get(`select * from district order by district_id desc`))
      .district_id + 1
  await db.run(
    `insert into district values (${districtId}, '${req.body.districtName}', ${req.body.stateId}, ${req.body.cases}, ${req.body.cured}, ${req.body.active}, ${req.body.deaths})`,
  )
  res.send('District Successfully Added')
})

app.get('/districts/:districtId/', authenticate, async (req, res) => {
  const {districtId} = req.params
  const districtDetails = await db.get(
    `select * from district where district_id = ${districtId}`,
  )
  res.send({
    districtId: districtDetails.district_id,
    districtName: districtDetails.district_name,
    stateId: districtDetails.state_id,
    cases: districtDetails.cases,
    cured: districtDetails.cured,
    active: districtDetails.active,
    deaths: districtDetails.deaths,
  })
})

app.delete('/districts/:districtId/', authenticate, async (req, res) => {
  const {districtId} = req.params
  await db.run(`delete from district where district_id = ${districtId}`)
  res.send('District Removed')
})

app.put('/districts/:districtId/', authenticate, async (req, res) => {
  const {districtId} = req.params

  console.log(`update district set district_name = '${req.body.districtName}', 
  state_id = ${req.body.stateId}, cases = ${req.body.cases}, cured = ${req.body.cured},
  active = ${req.body.active}, deaths = ${req.body.deaths} where district id = ${districtId}`)

  await db.run(`update district set district_name = '${req.body.districtName}', 
  state_id = ${req.body.stateId}, cases = ${req.body.cases}, cured = ${req.body.cured},
  active = ${req.body.active}, deaths = ${req.body.deaths} where district_id = ${districtId}`)
  res.send('District Details Updated')
})

app.get('/states/:stateId/stats/', authenticate, async (req, res) => {
  const {stateId} = req.params
  console.log(`select sum(cases) as totalCases, sum(cured) as totalCured,
  sum(active) as totalActive, sum(deaths) as totalDeaths
   from district where state_id = ${stateId} group by state_id`)
  res.send(
    await db.get(
      `select sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths from district where state_id = ${stateId} group by state_id;`,
    ),
  )
})

app.listen(3000, () => {
  console.log('server started.')
})

module.exports = app
