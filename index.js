const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const stripe = require("stripe")(process.env.SECRET_KEY)


app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Allow specific HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
}));

app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.22d6kxh.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
function verifyJWT(req, res, next) {
  const authHeader = req.headers.token
  if (!authHeader) {
    return res.status(401).send('Unauthorized Access')
  }
  jwt.verify(authHeader, process.env.ACCESS_TOKEN, function (error, decoded) {
    if (error) {
      return res.status(403).send('forbidden access 1st')
    }
    req.decoded = decoded
    next()
  })
}
async function run() {
  try {
    const categoryCollection = client.db('bikroy').collection('categories')
    const userCollection = client.db('bikroy').collection('Users')
    const adCollection = client.db('bikroy').collection('ads')
    const cartCollection = client.db('bikroy').collection('cart')
    app.get('/catgory/:id', async (req, res) => {
      const id = req.params.id
      const query = { catID: id }
      const result = await categoryCollection.find(query).toArray()
      res.send(result)
    })
    app.get('/product/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await categoryCollection.findOne(query)
      res.send(result)
    })
    app.get('/cartproduct/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: id }
      const result = await cartCollection.findOne(query)
      res.send(result)
    })
    app.delete('/alldelete', verifyJWT, async (req, res) => {
      const id = req.body._id
      const query = { _id: new ObjectId(id) }
      const result1 = await categoryCollection.deleteOne(query)
      const filter = { _id: id }
      const find1 = await cartCollection.findOne(filter)
      if (find1) {
        const result2 = await cartCollection.deleteOne(filter)
      }
      const find2 = await adCollection.findOne(filter)
      if (find2) {
        const result3 = await adCollection.deleteOne(filter)
      }
      res.send(result1)

    })
    app.get('/isadmin/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      res.send({ isadmin: user?.role === 'admin' })
    })
    app.get('/isbuyer/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      res.send({ isbuyer: user?.status === 'Buyer' })
    })

    app.get('/isseller/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      res.send({ isseller: user?.status === 'Seller' })
    })
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const booking = req.body
      const price = booking.price
      const amount = parseFloat(price) * 100
      const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount: amount,
        payment_method_types: [
          'card'
        ]
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    app.post('/product', verifyJWT, async (req, res) => {
      const product = req.body
      const decodedEmail = req.decoded.email
      if (decodedEmail !== product.email) {
        return res.status(403).send('forbidden access')
      }
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)
      if (user.status === 'Seller') {
        const result = await categoryCollection.insertOne(product)
        res.send(result)
      }
      else {
        res.status(401).send('Unauthorized Access')
      }

    })
    app.get('/myProduct', verifyJWT, async (req, res) => {
      const email = req.query.email
      const decodedEmail = req.decoded.email
      if (decodedEmail !== email) {
        return res.status(403).send('forbidden access')
      }
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)
      if (user.status === 'Seller') {
        const product = await categoryCollection.find(query).toArray()
        res.send(product)
      }

    })
    app.get('/user', verifyJWT, async (req, res) => {
      const email = req.query.email
      const decodedEmail = req.decoded.email
      if (decodedEmail !== email) {
        return res.status(403).send('forbidden access')
      }
      const query = { email: email }
      const result = await userCollection.findOne(query)
      res.send(result)
    })
    app.get('/allproduct', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)
      if (user.role !== 'admin') {
        return res.status(403).send('forbidden access')
      }
      const result = await categoryCollection.find({}).toArray()
      res.send(result)
    })
    app.get('/alls&b', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)

      if (user.role !== 'admin') {
        return res.status(403).send('forbidden access')
      }
      const role = req.query.role
      const filter = { status: role }
      const result = await userCollection.find(filter).toArray()
      res.send(result)
    })
    app.patch('/verify/:id', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)

      if (user.role !== 'admin') {
        return res.status(403).send('forbidden access')
      }
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updateDocs = {
        $set: {
          verify: true
        }
      }
      const options = { upsert: true }
      const result = await userCollection.updateOne(filter, updateDocs, options)
      res.send(result)

    })
    app.post('/ad', verifyJWT, async (req, res) => {
      const product = req.body
      const decodedEmail = req.decoded.email
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)

      if (user.role !== 'admin') {
        return res.status(403).send('forbidden access')
      }
      const filter = { img: product.img }
      const findValue = await adCollection.findOne(filter)
      if (!findValue) {
        const result = await adCollection.insertOne(product)
        res.send(result)
      }
      else {
        res.send({ sms: 'Already added' })
      }
    })
    app.get('/ad', async (req, res) => {
      const result = await adCollection.find({}).toArray()
      res.send(result)
    })
    app.put('/delete/:id', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)

      if (user.role !== 'admin') {
        return res.status(403).send('forbidden access')
      }
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(filter)
      res.send(result)
    })
    app.put('/productdelete/:id', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)

      if (user.status !== 'Seller') {
        return res.status(403).send('forbidden access')
      }
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const result = await categoryCollection.deleteOne(filter)
      res.send(result)

    })
    app.post('/cart', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)

      if (user.status !== 'Buyer') {
        return res.status(403).send('forbidden access')
      }

      const product = req.body
      const result = await cartCollection.insertOne(product)
      res.send(result)
    })
    app.get('/cart', verifyJWT, async (req, res) => {
      const email = req.query.email
      const decodedEmail = req.decoded.email
      if (email !== decodedEmail) {
        return res.status(403).send('forbidden access')
      }
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query)

      if (user.status !== 'Buyer') {
        return res.status(403).send('forbidden access')
      }

      const filter = { email: decodedEmail }
      const result = await cartCollection.find(filter).toArray()
      res.send(result)
    })
    app.get('/verifyProduct', async (req, res) => {
      const email = req.query.email
      const query = { email: email }
      const result = await userCollection.findOne(query)
      console.log(result)
      if (result.verify) {
        res.send({ verify: true })
      }
      else {
        res.send({ verify: false })
      }

    })
    app.post('/users', async (req, res) => {
      const details = req.body
      const query = { email: details.email }
      const search = await userCollection.findOne(query)
      if (!search) {
        const result = await userCollection.insertOne(details)
        res.send(result)
      }
      res.send('Already added')
    })
    app.get('/jwt', async (req, res) => {
      const email = req.query.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN)
        return res.send({ accessToken: token })
      }
      return res.status(403).send({ accessToken: '' })
    })
  } finally {

  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Bikroy.com')
})

app.listen(port, () => {
  console.log(`your server is running on port ${port}`)
})

