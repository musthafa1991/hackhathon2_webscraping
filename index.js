console.log("hi 1");
import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import axios from "axios";
import cheerio from "cheerio";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jsonwebtoken from "jsonwebtoken";
import jwt from "jsonwebtoken";


dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());


// function auth(req, res, next) {
//   if (req.headers.authorization) {
//     let check = jwt.verify(req.headers.authorization, process.env.SECRET_KEY)
//     console.log(check);
//     if (check) {
//       next()
//     } else {
//       res.status(401).send({ message: "not allowed" })
//     }
//   } else {
//     res.status(401).send({ message: "not allowed" })
//   };
// }


function auth(req, res, next) {
  try {
    let token=req.headers.authorization;
    console.log(token)
      jwt.verify(token, process.env.SECRET_KEY);
      next();
    
  } catch (err) {
    res.status(401).send({error:err.message})
  }

}

const PORT = process.env.PORT;
// const MONGO_URL="mongodb://localhost:27017";
const MONGO_URL = process.env.MONGO_URL


async function createconnection() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  console.log("mongo connected")
  return client;
}
const client = await createconnection();

app.get("/", function (req, res) {
  res.send({ message: "hi dear" });
})

app.get("/mobiles",auth, async function (req, res) {
  const mobiles = await client.db("products").collection("mobile").find({}).toArray();
  res.send(mobiles);
})


async function genpassword(password) {
  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(password, salt);
  return hashPassword;
}



app.post("/signup", async function (req, res) {
  const { username, email, password } = req.body;
  const hashPassword = await genpassword(password);
  const newUser = {
    username: username,
    email: email,
    password: hashPassword
  }
  const result = await client.db("products").collection("users").insertOne(newUser)
  res.send(result)

})

app.post("/signin", async function (req, res) {
  const { username, password } = req.body;
  const userDb = await client.db("products").collection("users").findOne({ username: username });
  if (!userDb) {
    res.status(401).send("invalid credentials")
  }
  else {
    const storedPass = userDb.password;
    const isPassMatch = await bcrypt.compare(password, storedPass);
    if (isPassMatch) {
      const token = jwt.sign({ id: userDb._id }, process.env.SECRET_KEY);
      // const token = jwt.sign({ id: userDb._id }, process.env.SECRET_KEY, { expiresIn: "30s" });
      console.log(token)
      res.send({ message: "successfully loggen in", token: token })
    }
    else {
      res.status(401).send("invalid credentials")
      console.log("error")
    }

  }


})


async function scrapData() {
  try {
    const mobileurl = "https://www.flipkart.com/search?q=mobiles&as=on&as-show=on&otracker=AS_Query_TrendingAutoSuggest_1_0_na_na_na&otracker1=AS_Query_TrendingAutoSuggest_1_0_na_na_na&as-pos=1&as-type=TRENDING&suggestionId=mobiles&requestId=9af3caf0-9825-4c94-8293-4a8ea873e443";
    const mobileList = [];

    const { data } = await axios.get(mobileurl);
    const $ = cheerio.load(data);

    const mobileimage = $(".CXW8mj img");

    const mobileTitle = $("._4rR01T");
    const mobileRating = $("._3LWZIK");
    const mobileOfferPrice = $("._30jeq3");
    const mobilePrice = $("._3I9_wc");


    const category = { image: "", title: "", rating: "", price: 0, offerprice: 0 };

    mobileimage.each((idx, el) => {
      category.image = $(el).attr("src");

      mobileList.push(category);
    });

    mobileTitle.each((idx, el) => {
      category.title = $(el).text();
      mobileList.push(category);
    });

    // mobileRating.each((idx,el)=>{
    //  category.rating = $(el);
    //  mobileList.push(category);
    // })

    mobilePrice.each((idx, el) => {
      category.price = $(el).text();
      mobileList.push(category);
    })

    mobileOfferPrice.each((idx, el) => {
      category.offerprice = $(el).text();
      mobileList.push(category);
    })

    console.log(mobileList);
    async function pushMongoAtlas(data) {
      console.log(data);
      const result = await client.db("products").collection("mobile").insertMany(data);
      console.log("updated successfully");
      // const result= await client.db("products").collection("mobile").find({}).toArray();
      console.log(result)
    }

    pushMongoAtlas(mobileList);

    //   fs.writeFile("mobiles.json", JSON.stringify(mobileList, null, 2), (err) => {
    //     if (err) {
    //       console.error(err);
    //       return;
    //     }
    //     console.log("Successfully written data to file");
    //   });
  } catch (err) {
    console.error(err);
  }
}
// Invoke the above function
//   scrapData();
//  



app.listen(PORT, () => console.log("server started in Port", PORT));