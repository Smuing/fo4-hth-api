const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const API_KEY = process.env.API_KEY;

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());

// const originWhitelist = [FRONT_HOST];

// app.use((req, res, next) => {
//   if (originWhitelist.indexOf(req.headers.origin) === -1) {
//     console.log(req);
//     console.log(req.headers.origin);
//     res
//       .status(403)
//       .json({ message: "You don't have permission to access this resource." });
//   } else {
//     next();
//   }
// });

app.get("/matchids", async (req, res, next) => {
  const firstInput = req.query.first_user;
  const secondInput = req.query.second_user;

  if (firstInput === undefined || secondInput === undefined) {
    res.status(404).json({ message: "{first_user} or {second_user} is required" });
  } else {
    var accessIds = [];
    var originalNickname = [];
    var matchIds = [];

    try {
      const firstUserInfo = await axios({
        url: `https://api.nexon.co.kr/fifaonline4/v1.0/users?nickname=${firstInput}`,
        method: "get",
        headers: { Authorization: API_KEY },
      });
      accessIds.push(firstUserInfo.data.accessId);
      originalNickname.push(firstUserInfo.data.nickname);
      const secondUserInfo = await axios({
        url: `https://api.nexon.co.kr/fifaonline4/v1.0/users?nickname=${secondInput}`,
        method: "get",
        headers: { Authorization: API_KEY },
      });
      accessIds.push(secondUserInfo.data.accessId);
      originalNickname.push(secondUserInfo.data.nickname);
    } catch (err) {
      if (err?.response?.data?.message == "User could not found") {
        return res.status(404).json({ message: "User could not found" });
      }
      next(err);
    }
  }
});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(500).json({ message: "Server Error" });
});

app.listen(port, () => {
  console.log(`server is listening at localhost:${port}`);
});
