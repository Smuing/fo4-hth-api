import express from "express";
import request from "request";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

const app = express();

// const whitelist = ["https://smuing.github.io", "https://fo4hth.site", "http://localhost:5500", "http://127.0.0.1:5500"];
// const corsOptions = {
//   origin: function (origin, callback) {
//     if (whitelist.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not Allowed Origin"));
//     }
//   },
// };
// app.use(cors(corsOptions));
app.use(cors());

app.use((error, req, res, next) => {
  res.json({ message: error.message });
});

dotenv.config({ path: "./.env" });

const apiUrl = "https://api.nexon.co.kr/fifaonline4/v1.0";
const HEADER = { Authorization: process.env.API_KEY };

app.get("/matchids", (req, res) => {
  const firstInput = req.query.first;
  const secondInput = req.query.second;
  
  console.log(req.headers.origin);

  if (firstInput === undefined || secondInput === undefined) {
    res.status(404).json({ message: "{first} or {second} is required" });
  } else {
    var accessIds = [];
    var originalNickname = [];

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
          originalNickname.push(body.nickname);

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
                originalNickname.push(body.nickname);

                var matchIds = [];

                var noMatch = false;
                for await (const userId of accessIds) {
                  var endMatch = false;
                  var offset = 0;
                  while (!endMatch) {
                    await fetch(
                      `${apiUrl}/users/${userId}/matches?matchtype=40&offset=${offset}`,
                      {
                        method: "GET",
                        headers: HEADER,
                      }
                    )
                      .then((response) => response.json())
                      .then((body) => {
                        if (body.length === 0) {
                          if (offset == 0) {
                            res.json({
                              message: `No matches user${accessIds.findIndex(
                                (id) => id == userId
                              )}`,
                              userInfo: { nickname: originalNickname },
                            });
                            noMatch = true;
                          }
                          endMatch = true;
                        } else {
                          matchIds.push(...body);
                          if (offset >= 100) {
                            endMatch = true;
                          } else {
                            offset += 100;
                          }
                        }
                      });
                  }
                }
                if (matchIds.length === 0) {
                  res.json({ message: "No last matches" });
                } else {
                  if (!noMatch) {
                    res.json({
                      userInfo: { nickname: originalNickname, accessIds },
                      matchIds,
                    });
                  }
                }
              }
            }
          );
        }
      }
    );
  }
});

app.get("/matchdetail", async (req, res) => {
  const accessIds = req.query.accessIds.split(",");
  const matchIds = req.query.matchIds.split(",");
  const abnormalGame = req.query.abnormalGame;

  var totalMatch = 0;
  var totalWin = 0;
  var totalDraw = 0;
  var totalLose = 0;
  var matchData = [];
  var offset = 0;

  for await (const matchId of matchIds) {
    if (totalMatch == 10) {
      break;
    }
    const data = await fetch(`${apiUrl}/matches/${matchId}`, {
      method: "GET",
      headers: HEADER,
    }).then((response) => response.json());
    const matchInfo = data.matchInfo;
    if (abnormalGame != "true") {
      if (
        !matchInfo[0].matchDetail.matchEndType == 0 &&
        !matchInfo[1].matchDetail.matchEndType == 0
      ) {
        continue;
      }
    }
    if (
      accessIds.find((id) => id == matchInfo[0].accessId) &&
      accessIds.find((id) => id == matchInfo[1].accessId)
    ) {
      totalMatch++;
      const firstData =
        matchInfo[matchInfo[0].accessId == accessIds[0] ? 0 : 1];
      const secondData =
        matchInfo[matchInfo[0].accessId == accessIds[1] ? 0 : 1];

      if (firstData.matchDetail.matchResult == "승") {
        totalWin++;
      } else if (firstData.matchDetail.matchResult == "무") {
        totalDraw++;
      } else {
        totalLose++;
      }
      matchData.push({
        id: data.matchId,
        date: data.matchDate,
        matchResult: firstData.matchDetail.matchResult,
        firstGoal: firstData.shoot.goalTotalDisplay,
        secondGoal: secondData.shoot.goalTotalDisplay,
        shootOut:
          firstData.shoot.shootOutScore > 0 ||
          secondData.shoot.shootOutScore > 0,
        firstShootOutGoal: firstData.shoot.shootOutScore,
        secondShootOutGoal: secondData.shoot.shootOutScore,
        abnormalEnd:
          !matchInfo[0].matchDetail.matchEndType == 0 &&
          !matchInfo[1].matchDetail.matchEndType == 0,
      });
      offset = matchIds.indexOf(data.matchId);
    }
  }
  if (totalMatch === 0) {
    res.json({ message: "No last matches" });
  } else {
    res.json({
      offset,
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
});

app.get("/match", async (req, res) => {
  const matchId = req.query.matchId;
  const firstNick = req.query.first;

  const response = await fetch(
    "https://static.api.nexon.co.kr/fifaonline4/latest/spid.json"
  );
  const playerInfo = await response.json();

  fetch(`${apiUrl}/matches/${matchId}`, {
    method: "GET",
    headers: HEADER,
  })
    .then((response) => response.json())
    .then((data) => {
      const matchInfo = data.matchInfo;
      const firstData = matchInfo[matchInfo[0].nickname == firstNick ? 0 : 1];
      const secondData = matchInfo[matchInfo[0].nickname == firstNick ? 1 : 0];
      let firstPlayers = [];
      let secondPlayers = [];

      for (let i = 0; i < 28; i++) {
        firstPlayers.push({
          spName: playerInfo.find(
            (player) =>
              player.id ==
              firstData.player.find((player) => player.spPosition == i)?.spId
          )?.name,
          spRating: firstData.player.find((player) => player.spPosition == i)
            ?.status.spRating,
          spGoal: firstData.player.find((player) => player.spPosition == i)
            ?.status.goal,
        });
      }
      for (let i = 0; i < 28; i++) {
        secondPlayers.push({
          spName: playerInfo.find(
            (player) =>
              player.id ==
              secondData.player.find((player) => player.spPosition == i)?.spId
          )?.name,
          spRating: secondData.player.find((player) => player.spPosition == i)
            ?.status.spRating,
          spGoal: secondData.player.find((player) => player.spPosition == i)
            ?.status.goal,
        });
      }

      res.json({
        firstRating: ((firstData.matchDetail.averageRating * 18) / 11).toFixed(
          1
        ),
        firstPlayers,
        secondRating: (
          (secondData.matchDetail.averageRating * 18) /
          11
        ).toFixed(1),
        secondPlayers,
      });
    });
});

app.listen(process.env.PORT || 3000, function () {
  console.log(
    "Express server listening on port %d in %s mode",
    this.address().port,
    app.settings.env
  );
});
