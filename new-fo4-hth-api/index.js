const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());

const originWhitelist = [FRONT_HOST];

app.use((req, res, next) => {
  if (originWhitelist.indexOf(req.headers.origin) === -1) {
    console.log(req);
    console.log(req.headers.origin);
    res
      .status(403)
      .json({ message: "You don't have permission to access this resource." });
  } else {
    next();
  }
});

app.get("/matchids", (req, res) => {
  const firstInput = req.query.first;
  const secondInput = req.query.second;

  if (firstInput === undefined || secondInput === undefined) {
    res.status(404).json({ message: "{first_user} or {second_user} is required" });
  } else {
    var accessIds = [];
    var originalNickname = [];
  }
});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(500).json({ message: "Server Error" });
});

app.listen(port, () => {
  console.log(`server is listening at localhost:${port}`);
});
