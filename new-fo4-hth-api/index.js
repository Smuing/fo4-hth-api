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
    return res.status(404).json({ message: "{first_user} or {second_user} is required" });
  } else {
    var accessIds = [];
    var originalNickname = [];
    var matchIds = [];
    var noMatch = false;
    var noMatchUser = [false, false];

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

      for await (const userId of accessIds) {
        var endMatch = false;
        var offset = 0;
        while (!endMatch) {
          const getMatchIds = await axios({
            url: `https://api.nexon.co.kr/fifaonline4/v1.0/users/${userId}/matches?matchtype=40&offset=${offset}`,
            method: "get",
            headers: { Authorization: API_KEY },
          });
          console.log(userId, getMatchIds.data.length);
          if (getMatchIds.data.length === 0) {
            if (offset == 0) {
              noMatchUser[accessIds.findIndex(id => id == userId)] = true;
              noMatch = true;
            }
            endMatch = true;
          } else {
            matchIds.push(...getMatchIds.data);
            offset += 100;
          }
        }
      }

      if (matchIds.length === 0 || noMatch) {
        if (noMatchUser[0] && noMatchUser[1])
          return res.status(404).json({ message: "No last matches" });
        if (noMatchUser[0])
          return res.status(404).json({
            message: "No matches first_user",
            userInfo: { nickname: originalNickname[0] },
          });
        if (noMatchUser[1])
          return res.status(404).json({
            message: "No matches second_user",
            userInfo: { nickname: originalNickname[1] },
          });
      } else {
        return res.json({
          userInfo: { nickname: originalNickname, accessIds },
          matchIds,
        });
      }
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
  return res.status(500).json({ message: "Server Error" });
});

app.listen(port, () => {
  console.log(`server is listening at localhost:${port}`);
});
