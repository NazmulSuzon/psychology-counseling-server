const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5ljqqlm.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

function verifyJWT(req, res, next){
  // console.log('Token inside verifyJWT', req.headers.authorization);
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.send(401).send('Unauthorized access');
  }

  const token = authHeader.split(' ')[1];
}

async function run() {
  try {
    const appointmentOptionCollection = client.db('psychologyCounseling').collection('appointmentOptions');
    const bookingsCollection = client.db('psychologyCounseling').collection('bookings');
    const usersCollection = client.db('psychologyCounseling').collection('users');

    // use aggregate to query multiple collection and then merge data
    app.get('/appointmentOptions', async(req, res) =>{
        const date = req.query.date;
        const query = {};
        const options = await appointmentOptionCollection.find(query).toArray();

        // Get the bookings of the provided date
        const bookingQuery = {appointmentDate: date};
        const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

        options.forEach(option =>{
          const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
          const bookedSlots = optionBooked.map(book => book.slot);
          const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
          option.slots = remainingSlots;
        })
        res.send(options);
    })

    /*
      *API Naming Convention
      *bookings
      *app.get('/bookings')
      *app.get('/bookings/:id')
      *app.post('/bookings')
      *app.patch('/bookings/:id')
      *app.delete('/bookings/:id')
    */ 

    // bookings related
    app.get('/bookings', verifyJWT, async(req, res) =>{
      const email = req.query.email;
      const query = {email: email};
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    })

    app.post('/bookings', async(req, res) => {
      const booking = req.body;
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment
      }

      const alreadyBooked = await bookingsCollection.find(query).toArray();

      if(alreadyBooked.length){
        const message = `You already have a booking on ${booking.appointmentDate}`
        return res.send({acknowledged: false, message})
      }

      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    })
    // bookings related section closed

    // user related
    app.get('/jwt', async(req, res) =>{
      const email = req.query.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      if(user){
        const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '1h'})
        return res.send({accessToken: token});
      }
      res.status(403).send({accessToken: ''})
    })

    app.post('/users', async(req, res) =>{
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })


    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } 
  finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', async(req, res) =>{
    res.send('psychology-counseling-server is running');
})

app.listen(port, () => console.log(`psychology-counseling-server running on ${port}`))