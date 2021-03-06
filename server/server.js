const express = require("express");
const cokieParser = require("cookie-parser");
const formidable = require("express-formidable");
const cloudinary = require("cloudinary");
const moment = require("moment");
const SHA1 = require("crypto-js/sha1");

const app = express();
const mongoose = require("mongoose");
const async = require("async");
require("dotenv").config();

mongoose.Promise = global.Promise;
mongoose.connect(process.env.DATABASE);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cokieParser());

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Models
const { User } = require("./models/user");
const { Shipping } = require("./models/shipping");
const { Product } = require("./models/product");
const { Payment } = require("./models/payment");
const { Site } = require("./models/site");

// Middlewares
const { auth } = require("./middleware/auth");
const { admin } = require("./middleware/admin");

//=============================
//            NODE MAILER
// ============================
const { sendEmail } = require("./utils/mail/index");

//=================================
//             ADMIN UPLOADS
//================================

const multer = require("multer");
let storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${"lickfinger"}_${file.originalname}`);
  },
});

const upload = multer({ storage: storage }).single("file");

app.post("/api/users/uploadfile", auth, admin, (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.json({ success: false, err });
    }
    return res.json({ success: true });
  });
});

const fs = require("fs");
const path = require("path");
const { nextTick } = require("process");

app.get("/api/users/admin_files", auth, admin, (req, res) => {
  const dir = path.resolve(".") + "/uploads/";
  fs.readdir(dir, (err, items) => {
    return res.status(200).send(items);
  });
});

app.get("/api/users/download/:id", auth, admin, (req, res) => {
  const file = path.resolve(".") + `/uploads/${req.params.id}`;
  res.download(file);
});

//=============================
//            PRODUCTS
// ============================

app.post("/api/product/shop", (req, res) => {
  let order = req.body.order ? req.body.order : "desc";
  let sortBy = req.body.sortBy ? req.body.sortBy : "_id";
  let limit = req.body.limit ? parseInt(req.body.limit) : 100;
  let skip = parseInt(req.body.skip);
  let findArgs = {};

  for (let key in req.body.filters) {
    if (req.body.filters[key].length > 0) {
      if (key === "price") {
        findArgs[key] = {
          $gte: req.body.filters[key][0],
          $lte: req.body.filters[key][1],
        };
      } else {
        findArgs[key] = req.body.filters[key];
      }
    }
  }

  findArgs["publish"] = true;

  Product.find(findArgs)
    .sort([[sortBy, order]])
    .skip(skip)
    .limit(limit)
    .exec((err, articles) => {
      if (err) return res.status(400).send(err);
      res.status(200).json({
        size: articles.length,
        articles,
      });
    });
});

// BY ARRRIVAL
// /articles?sortBy=createdAt&order=desc&limit=4

//BY SELL
// /articles?sortBysold&order=desc&limit=100&skip=5
app.get("/api/product/articles", (req, res) => {
  let order = req.query.order ? req.query.order : "asc";
  let sortBy = req.query.sortBy ? req.query.sortBy : "_id";
  let limit = req.query.limit ? parseInt(req.query.limit) : 100;
  Product.find()
    .sort([[sortBy, order]])
    .limit(limit)
    .exec((err, articles) => {
      if (err) return res.status(400).send(err);
      res.send(articles);
    });
});

/// /api/product/article?id=KZJXBL,BIAHLDBASD,UYKUGOAGUD&type=array
app.get("/api/product/articles_by_id", (req, res) => {
  let type = req.query.type;
  let items = req.query.id;

  if (type === "array") {
    let ids = req.query.id.split(",");
    items = [];
    items = ids.map((item) => {
      return mongoose.Types.ObjectId(item);
    });
  }
  Product.find({ _id: { $in: items } }).exec((err, docs) => {
    return res.status(200).send(docs);
  });
});

app.post("/api/product/article", auth, admin, (req, res) => {
  const product = new Product(req.body);

  product.save((err, doc) => {
    if (err) return res.json({ success: false, err });
    res.status(200).json({
      success: true,
      article: doc,
    });
  });
});

// app.delete('/api/product/delete_product/:id' ,auth, admin, (req, res) => {
//   Product.findByIdAndRemove(req.params.id,
//      (err, tasks) => {
//     if (err) return res.status(500).send(err);
//     const response = {
//         message: "Todo successfully deleted",
//         id: req.params.id
//     };
//     return res.status(200).send(response);

//   });
// })

//   app.get('/api/product/delete_product/:id' ,auth, admin, (req, res) => {
//   User.findOneAndUpdate(
//     {_id: req.user._id },
//     { "$pull":
//         { "cart": {"id":mongoose.Types.ObjectId(req.params.id)} }
//     },
//     { new: true },
//     (err,doc)=>{
//         let cart = doc.cart;
//         let array = cart.map(item=>{
//             return mongoose.Types.ObjectId(item.id)
//         });

//         Product.findByIdAndRemove(req.params.id,
//             (err, tasks) => {
//           if (err) return res.status(500).send(err);
//           const response = {
//               message: "Todo successfully deleted",
//               id: req.params.id
//           };
//           return res.status(200).send(response);

//         });
//     }
// );
// })

app.delete("/api/product/delete_product/:id", auth, admin, (req, res) => {
  User.find({}, (err, users) => {
    if (err) res.send("error");
    users.forEach((user) => {
      user.cart.forEach((cartItem) => {
        if (req.params.id == cartItem.id) {
          User.findOneAndUpdate(
            { _id: user._id },
            { "$pull": { "cart": { id: mongoose.Types.ObjectId(req.params.id) } } },
            { new: true },
            (err, doc) => {
              Product.findByIdAndRemove(req.params.id, (err, tasks) => {
                if (err) return res.status(500).send(err);
                const response = {
                  message: "Todo successfully deleted",
                  id: req.params.id,
                };
                return res.status(200).send(response);
              });
            }
          );
        }
      });
      Product.findByIdAndRemove(req.params.id, (err, tasks) => {
        if (err) return res.status(500).send(err);
        const response = {
          message: "Todo successfully deleted",
          id: req.params.id,
        };
        return res.status(200).send(response);
      });
    });

    //  Product.findByIdAndRemove(req.params.id,
    //        (err, tasks) => {
    //       if (err) return res.status(500).send(err);
    //       const response = {
    //           message: "Todo successfully deleted",
    //           id: req.params.id
    //       };
    //       return res.status(200).send(response);

    //     });
  });
});

//=============================
//            USERS
// ============================

app.post("/api/users/reset_user", (req, res) => {
  User.findOne({ email: req.body.email }, (err, user) => {
    user.generateResetToken((err, user) => {
      if (err) return res.json({ success: false, err });
      sendEmail(user.email, user.name, null, "reset_password", user);
      return res.json({ success: true });
    });
  });
});

app.post("/api/users/reset_password", (req, res) => {
  var today = moment().startOf("day").valueOf();

  User.findOne(
    {
      resetToken: req.body.resetToken,
      resetTokenExp: {
        $gte: today,
      },
    },
    (err, user) => {
      if (!user)
        return res.json({
          success: false,
          message: "Sorry, token bad, generate a new one.",
        });

      user.password = req.body.password;
      user.resetToken = "";
      user.resetTokenExp = "";

      user.save((err, doc) => {
        if (err) return res.json({ success: false, err });
        return res.status(200).json({
          success: true,
        });
      });
    }
  );
});

app.get("/api/users/auth", auth, (req, res) => {
  res.status(200).json({
    isAdmin: req.user.role === 0 ? false : true,
    isAuth: true,
    email: req.user.email,
    name: req.user.name,
    lastname: req.user.lastname,
    address: req.user.address,
    phone: req.user.phone,
    role: req.user.role,
    cart: req.user.cart,
    history: req.user.history,
  });
});

app.post("/api/users/register", (req, res) => {
  const user = new User(req.body);

  user.save((err, doc) => {
    if (err) return res.json({ success: false, err });
    sendEmail(doc.email, doc.name, null, "welcome");
    return res.status(200).json({
      success: true,
    });
  });
});

app.post("/api/users/login", (req, res) => {
  User.findOne({ email: req.body.email }, (err, user) => {
    if (!user)
      return res.json({
        loginSuccess: false,
        message: "Auth failed, email not found",
      });

    user.comparePassword(req.body.password, (err, isMatch) => {
      if (!isMatch)
        return res.json({ loginSuccess: false, message: "Wrong password" });

      user.generateToken((err, user) => {
        if (err) return res.status(400).send(err);
        res.cookie("w_auth", user.token).status(200).json({
          loginSuccess: true,
        });
      });
    });
  });
});

app.get("/api/users/logout", auth, (req, res) => {
  User.findOneAndUpdate({ _id: req.user._id }, { token: "" }, (err, doc) => {
    if (err) return res.json({ success: false, err });
    return res.status(200).send({
      success: true,
    });
  });
});

app.post("/api/users/uploadimage", auth, admin, formidable(), (req, res) => {
  cloudinary.uploader.upload(
    req.files.file.path,
    (result) => {
      res.status(200).send({
        public_id: result.public_id,
        url: result.url,
      });
    },
    {
      public_id: `${Date.now()}`,
      resource_type: "auto",
    }
  );
});

app.get("/api/users/removeimage", auth, admin, (req, res) => {
  let image_id = req.query.public_id;

  cloudinary.uploader.destroy(image_id, (error, result) => {
    if (error) return res.json({ succes: false, error });
    res.status(200).send("ok");
  });
});

app.post("/api/users/addToCart", auth, (req, res) => {
  User.findOne({ _id: req.user._id }, (err, doc) => {
    let duplicate = false;

    doc.cart.forEach((item) => {
      if (item.id == req.query.productId) {
        duplicate = true;
      }
    });

    if (duplicate) {
      User.findOneAndUpdate(
        {
          _id: req.user._id,
          "cart.id": mongoose.Types.ObjectId(req.query.productId),
        },
        { $inc: { "cart.$.quantity": 1 } },
        { new: true },
        () => {
          if (err) return res.json({ success: false, err });
          res.status(200).json(doc.cart);
        }
      );
    } else {
      User.findOneAndUpdate(
        { _id: req.user._id },
        {
          $push: {
            cart: {
              id: mongoose.Types.ObjectId(req.query.productId),
              quantity: 1,
              date: Date.now(),
            },
          },
        },
        { new: true },
        (err, doc) => {
          if (err) return res.json({ success: false, err });
          res.status(200).json(doc.cart);
        }
      );
    }
  });
});

app.post("/api/users/subtractFromCart", auth, (req, res) => {
  User.findOne({ _id: req.user._id }, (err, doc) => {
    let duplicate = false;

    doc.cart.forEach((item) => {
      if (item.id == req.query.productId && item.quantity > 1) {
        duplicate = true;
      }
    });

    if (duplicate) {
      User.findOneAndUpdate(
        {
          _id: req.user._id,
          "cart.id": mongoose.Types.ObjectId(req.query.productId),
        },
        { $inc: { "cart.$.quantity": -1 } },
        { new: true },
        () => {
          if (err) return res.json({ success: false, err });
          res.status(200).json(doc.cart);
        }
      );
    }
  });
});

app.get("/api/users/removeFromCart", auth, (req, res) => {
  User.findOneAndUpdate(
    { _id: req.user._id },
    { "$pull": { "cart": { id: mongoose.Types.ObjectId(req.query._id) } } },
    { new: true },
    (err, doc) => {
      let cart = doc.cart;
      let array = cart.map((item) => {
        return mongoose.Types.ObjectId(item.id);
      });

      Product.find({ _id: { $in: array } }).exec((err, cartDetail) => {
        return res.status(200).json({
          cartDetail,
          cart,
        });
      });
    }
  );
});

app.post("/api/users/successBuy", auth, (req, res) => {
  let history = [];
  let transactionData = {};
  const date = new Date();
  const po = `PO-${date.getSeconds()}${date.getMilliseconds()}-${SHA1(
    req.user._id
  )
    .toString()
    .substring(0, 8)}`;

  // user history
  req.body.cartDetail.forEach((item) => {
    history.push({
      porder: po,
      dateOfPurchase: Date.now(),
      name: item.name,
      id: item._id,
      price: item.price,
      quantity: item.quantity,
      paymentId: req.body.paymentData.paymentID,
    });
  });

  // PAYMENTS DASH
  transactionData.user = {
    id: req.user._id,
    name: req.user.name,
    lastname: req.user.lastname,
    email: req.user.email,
  };
  transactionData.data = {
    ...req.body.paymentData,
    porder: po,
  };
  transactionData.product = history;

  User.findOneAndUpdate(
    { _id: req.user._id },
    { $push: { history: history }, $set: { cart: [] } },
    { new: true },
    (err, user) => {
      if (err) return res.json({ success: false, err });

      const payment = new Payment(transactionData);
      payment.save((err, doc) => {
        if (err) return res.json({ success: false, err });
        let products = [];
        doc.product.forEach((item) => {
          products.push({ id: item.id, quantity: item.quantity });
        });

        async.eachSeries(
          products,
          (item, callback) => {
            Product.updateOne(
              { _id: item.id },
              {
                $inc: {
                  sold: item.quantity,
                },
              },
              { new: false },
              callback
            );
          },
          (err) => {
            if (err) return res.json({ success: false, err });
            sendEmail(user.email, user.name, null, "purchase", transactionData);
            res.status(200).json({
              success: true,
              cart: user.cart,
              cartDetail: [],
            });
          }
        );
      });
    }
  );
});

app.post("/api/users/update_profile", auth, (req, res) => {
  User.findOneAndUpdate(
    { _id: req.user._id },
    {
      $set: req.body,
    },
    { new: true },
    (err, doc) => {
      if (err) return res.json({ success: false, err });
      return res.status(200).send({
        success: true,
      });
    }
  );
});

//=================================
//              SITE
//=================================

app.get("/api/site/site_data", (req, res) => {
  Site.find({}, (err, site) => {
    if (err) return res.status(400).send(err);
    res.status(200).send(site[0].siteInfo);
  });
});

app.post("/api/site/site_data", auth, admin, (req, res) => {
  Site.findOneAndUpdate(
    { name: "Site" },
    { $set: { siteInfo: req.body } },
    { new: true },
    (err, doc) => {
      if (err) return res.json({ success: false, err });
      return res.status(200).send({
        success: true,
        siteInfo: doc.siteInfo,
      });
    }
  );
});

//=============================
//            SHIPPING
// ============================
app.post("/api/shipping/shipping_data", auth, admin, (req, res) => {
  const shipping = new Shipping(req.body);

  shipping.save((err, doc) => {
    if (err) return res.json({ success: false, err });
    res.status(200).json({
      success: true,
      shipping: doc,
    });
  });
});

app.get("/api/shipping/shippings_data", (req, res) => {
  Shipping.find({}, (err, shippings) => {
    if (err) return res.status(400).send(err);
    res.status(200).send(shippings);
  });
});

const port = process.env.PORT || 3002;

app.listen(port, () => {
  console.log(`Server Running at ${port}`);
});

// DATABASE=mongodb+srv://WavesUser:<Revelation>@cluster0.ctpdi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority
// MONGODB://LOCALHOST:27017/lickfinger
