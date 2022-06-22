import express from "express";
import request from "request";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

const app = express();

const whitelist = ["https://smuing.github.io", "http://localhost:5501"];
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(res.sand("Not Allowed Origin"));
    }
  },
};
app.use(cors(corsOptions));

dotenv.config({ path: "./.env" });

const apiUrl = "https://api.nexon.co.kr/fifaonline4/v1.0";
const HEADER = { Authorization: process.env.API_KEY };

app.get("/search", (req, res) => {
  const firstInput = req.query.first;
  const secondInput = req.query.second;
  const limit = req.query.limit;
  if (firstInput === undefined || secondInput === undefined) {
    res.status(404).json({ message: "{first} or {second} is required" });
  } else {
    var accessIds = [];
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
          res.json({ message: "First user could not found" });
        } else {
          accessIds.push(body.accessId);
          request(
            apiUrl + "/users",
            {
              headers: HEADER,
              qs: {
                nickname: secondInput,
              },
            },
            async (err, response, body) => {
              body = JSON.parse(body);
              if (body.message == "User could not found") {
                res.json({ message: "Second user could not found" });
              } else {
                accessIds.push(body.accessId);

                var totalMatch = 0;
                var totalWin = 0;
                var totalDraw = 0;
                var totalLose = 0;
                var matchData = [];

                for await (const userId of accessIds) {
                  await fetch(
                    `${apiUrl}/users/${userId}/matches?matchtype=40&limit=${limit}`,
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
                          if (
                            matchData.find((match) => match.id == matchId) ==
                            undefined
                          ) {
                            const data = await fetch(
                              `${apiUrl}/matches/${matchId}`,
                              {
                                method: "GET",
                                headers: HEADER,
                              }
                            ).then((response) => response.json());
                            const matchInfo = data.matchInfo;
                            if (
                              matchInfo[0].matchDetail.matchEndType == 0 &&
                              matchInfo[1].matchDetail.matchEndType == 0
                            ) {
                              if (
                                matchInfo[0].accessId ==
                                  accessIds.find((id) => id != userId) ||
                                matchInfo[1].accessId ==
                                  accessIds.find((id) => id != userId)
                              ) {
                                totalMatch++;
                                const firstData =
                                  matchInfo[
                                    matchInfo[0].accessId == accessIds[0]
                                      ? 0
                                      : 1
                                  ];
                                const secondData =
                                  matchInfo[
                                    matchInfo[0].accessId == accessIds[0]
                                      ? 1
                                      : 0
                                  ];

                                if (firstData.matchDetail.matchResult == "승") {
                                  totalWin++;
                                } else if (
                                  firstData.matchDetail.matchResult == "무"
                                ) {
                                  totalDraw++;
                                } else {
                                  totalLose++;
                                }

                                if (
                                  firstData.shoot.shootOutScore > 0 ||
                                  secondData.shoot.shootOutScore > 0
                                ) {
                                  matchData.push({
                                    id: data.matchId,
                                    date: data.matchDate,
                                    matchResult:
                                      firstData.matchDetail.matchResult,
                                    firstGoal: firstData.shoot.goalTotalDisplay,
                                    secondGoal:
                                      secondData.shoot.goalTotalDisplay,
                                    shootOut: true,
                                    firstShootOutGoal:
                                      firstData.shoot.shootOutScore,
                                    secondShootOutGoal:
                                      secondData.shoot.shootOutScore,
                                  });
                                } else {
                                  matchData.push({
                                    id: data.matchId,
                                    date: data.matchDate,
                                    matchResult:
                                      firstData.matchDetail.matchResult,
                                    firstGoal: firstData.shoot.goalTotalDisplay,
                                    secondGoal:
                                      secondData.shoot.goalTotalDisplay,
                                  });
                                }
                              }
                            }
                          } else {
                            continue;
                          }
                        }
                      }
                    });
                }
                if (totalMatch === 0) {
                  res.json({ message: "No last matches" });
                } else {
                  res.json({
                    totalData: {
                      totalMatch,
                      totalResult: [totalWin, totalDraw, totalLose],
                      totalPer: [
                        Math.round((totalWin / totalMatch) * 100),
                        Math.round((totalDraw / totalMatch) * 100),
                        Math.round((totalLose / totalMatch) * 100),
                      ],
                    },
                    matchData,
                  });
                }
              }
            }
          );
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
