const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productSchema = mongoose.Schema({
  name:{
    required: true,
    type: String,
    unique: 1,
    maxlength : 50
  },
  description:{
    required: true,
    type: String,
    maxlength : 500
  },
  price:{
    required: true,
    type: Number,
    maxlength: 300
  },
  publish: {
    default: true,
    type: Boolean
  },
  images:{
    type: Array,
    default: []
  }
}, {timestamps:true});

const Product = mongoose.model('Product', productSchema);
module.exports = { Product }