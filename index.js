import express from "express";
import request from "request";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

const app = express();

const corsOptions = {
  origin: "https://smuing.github.io",
};

app.use(cors(corsOptions));
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
      async (err, response, body) => {
        body = JSON.parse(body);
        if (body.message == "User could not found") {
          res.json(body);
        } else {
          var totalMatch = 0;
          var matchData = [];
          const matchTypes = [30, 40, 50, 60];

          for (const matchType of matchTypes) {
            await fetch(
              `${apiUrl}/users/${body.accessId}/matches?matchtype=${matchType}&limit=30`,
              {
                method: "GET",
                headers: HEADER,
              }
            )
              .then((response) => response.json())
              .then(async (body) => {
                if (body.length === 0) {
                  return;
                } else {
                  for (const matchId of body) {
                    const data = await fetch(`${apiUrl}/matches/${matchId}`, {
                      method: "GET",
                      headers: HEADER,
                    }).then((response) => response.json());
                    const matchInfo = data.matchInfo;
                    if (
                      matchInfo[0].matchDetail.matchEndType == 0 &&
                      matchInfo[1].matchDetail.matchEndType == 0
                    ) {
                      if (
                        matchInfo[0].nickname == secondInput ||
                        matchInfo[1].nickname == secondInput
                      ) {
                        totalMatch++;
                        const firstData =
                          matchInfo[
                            matchInfo[0].nickname == secondInput ? 1 : 0
                          ];
                        const secondData =
                          matchInfo[
                            matchInfo[0].nickname == secondInput ? 0 : 1
                          ];
                        if (
                          firstData.shoot.shootOutScore > 0 ||
                          secondData.shoot.shootOutScore > 0
                        ) {
                          matchData.push({
                            id: data.matchId,
                            date: data.matchDate,
                            matchResult: firstData.matchDetail.matchResult,
                            firstGoal: firstData.shoot.goalTotalDisplay,
                            secondGoal: secondData.shoot.goalTotalDisplay,
                            shootOut: true,
                            firstShootOutGoal: firstData.shoot.shootOutScore,
                            secondShootOutGoal: secondData.shoot.shootOutScore,
                          });
                        } else {
                          matchData.push({
                            id: data.matchId,
                            date: data.matchDate,
                            matchResult: firstData.matchDetail.matchResult,
                            firstGoal: firstData.shoot.goalTotalDisplay,
                            secondGoal: secondData.shoot.goalTotalDisplay,
                          });
                        }
                      }
                    }
                  }
                }
              });
          }
          if (totalMatch === 0) {
            res.json({ message: "No last matches" });
          } else {
            res.json(matchData);
          }
        }
      }
    );
  }
});

app.listen(process.env.PORT || 3000, function () {
  console.log(
    "Express server listening on port %d in %s mode",
    this.address().port,
    app.settings.env
  );
});
