const mongoose = require('mongoose');

const shippingSchema = mongoose.Schema({
  name:{
    required: true,
    type: String,
    unique: 1,
    maxlength : 500
  },
  price:{
    required: true,
    type: Number,
    maxlength: 300
  },
});

const Shipping = mongoose.model('Shipping', shippingSchema);
module.exports = { Shipping }