import express from "express";
import request from "request";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

const app = express();

const corsOptions ={
   origin:'https://smuing.github.io'
}

app.use(cors(corsOptions))
dotenv.config({ path: "./.env" });

const apiUrl = "https://api.nexon.co.kr/fifaonline4/v1.0";
const HEADER = { Authorization: process.env.API_KEY };

app.get("/search", (req, res) => {
  const firstInput = req.query.first;
  const secondInput = req.query.second;
  if (firstInput === undefined || secondInput === undefined) {
    res.status(404).json({ message: "{first} or {second} is required" });
  } else {
    request(
      apiUrl + "/users",
      {
        headers: HEADER,
        qs: {
          nickname: firstInput,
        },
      },
      (err, response, body) => {
        body = JSON.parse(body);
        if (body.message == "User could not found") {
          res.json(body);
        } else {
          request(
            `${apiUrl}/users/${body.accessId}/matches`,
            {
              headers: HEADER,
              qs: {
                matchtype: 40,
                limit: 30,
              },
            },
            async (err, response, body) => {
              body = JSON.parse(body);
              if (body.length === 0) {
                res.json({ message: "No last 30 matches" });
              } else {
                var matchData = [];
                for (const matchId of body) {
                  const data = await fetch(`${apiUrl}/matches/${matchId}`, {
                    method: "GET",
                    headers: HEADER,
                  }).then((response) => response.json());
                  // console.log(data);
                  matchData.push(data);
                }
                res.json(matchData);
              }
            }
          );
        }
      }
    );
  }
});

app.listen(process.env.PORT || 3000, function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
