const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  bgColor: { type: String, default: "#1d2569" },
  icon: { type: String, default: "🍽️" },
});

module.exports = mongoose.model("Category", categorySchema);
