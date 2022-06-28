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
      callback(new Error("Not Allowed Origin"));
    }
  },
};
app.use(cors(corsOptions));

app.use((error, req, res, next) => {
  res.json({ message: error.message })
})

dotenv.config({ path: "./.env" });

const apiUrl = "https://api.nexon.co.kr/fifaonline4/v1.0";
const HEADER = { Authorization: process.env.API_KEY };

app.get("/matchids", (req, res) => {
  const firstInput = req.query.first;
  const secondInput = req.query.second;
  const offset = req.query.offset;
  const limit = req.query.limit;
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

                var noMatch = false;
                var matchIds = [];

                for await (const userId of accessIds) {
                  await fetch(
                    `${apiUrl}/users/${userId}/matches?matchtype=40&offset=${
                      offset ? offset : "0"
                    }&limit=${limit ? limit : "30"}`,
                    {
                      method: "GET",
                      headers: HEADER,
                    }
                  )
                    .then((response) => response.json())
                    .then(async (body) => {
                      if (body.length === 0) {
                        noMatch = true;
                        res.json({message: `No matches user${accessIds.findIndex(id=>id==userId)}`, userInfo: {nickname:originalNickname}})
                      } else {
                        matchIds.push(...body)
                      }
                      }
                    );
                }
                if (!noMatch) {
                  if (matchIds.length === 0) {
                    res.json({ message: "No last matches" });
                  } else {
                    res.json({
                      userInfo: {nickname:originalNickname,accessIds},
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

  var totalMatch = 0;
  var totalWin = 0;
  var totalDraw = 0;
  var totalLose = 0;
  var matchData = [];

  for await (const matchId of matchIds) {
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
          accessIds.find((id) => id == matchInfo[0].accessId) &&
          accessIds.find((id) => id == matchInfo[1].accessId)
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
})

app.get("/match", async (req, res) => {
  const matchId = req.query.matchId;
  const firstNick = req.query.first;

  const response = await fetch(
    "https://static.api.nexon.co.kr/fifaonline4/latest/spid.json"
  );
  const json = await response.json();

  fetch(`${apiUrl}/matches/${matchId}`, {
    method: "GET",
    headers: HEADER,
  })
    .then((response) => response.json())
    .then((data) => {
      const matchInfo = data.matchInfo;
      const firstData = matchInfo[matchInfo[0].nickname == firstNick ? 0 : 1];
      const secondData = matchInfo[matchInfo[0].nickname == firstNick ? 1 : 0];
      res.json({
        firstRating: ((firstData.matchDetail.averageRating * 18) / 11).toFixed(
          1
        ),
        firstPlayers: [
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 0)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 0)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 1)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 1)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 2)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 2)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 3)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 3)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 4)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 4)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 5)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 5)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 6)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 6)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 7)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 7)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 8)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 8)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 9)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 9)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 10)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 10)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 11)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 11)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 12)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 12)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 13)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 13)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 14)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 14)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 15)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 15)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 16)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 16)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 17)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 17)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 18)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 18)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 19)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 19)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 20)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 20)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 21)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 21)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 22)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 22)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 23)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 23)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 24)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 24)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 25)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 25)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 26)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 26)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                firstData.player.find((player) => player.spPosition == 27)?.spId
            )?.name,
            spRating: firstData.player.find((player) => player.spPosition == 27)
              ?.status.spRating,
          },
        ],
        secondRating: (
          (secondData.matchDetail.averageRating * 18) /
          11
        ).toFixed(1),
        secondPlayers: [
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 0)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 0)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 1)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 1)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 2)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 2)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 3)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 3)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 4)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 4)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 5)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 5)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 6)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 6)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 7)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 7)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 8)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 8)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 9)?.spId
            )?.name,
            spRating: secondData.player.find((player) => player.spPosition == 9)
              ?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 10)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 10
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 11)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 11
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 12)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 12
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 13)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 13
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 14)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 14
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 15)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 15
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 16)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 16
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 17)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 17
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 18)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 18
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 19)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 19
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 20)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 20
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 21)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 21
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 22)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 22
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 23)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 23
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 24)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 24
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 25)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 25
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 26)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 26
            )?.status.spRating,
          },
          {
            spName: json.find(
              (player) =>
                player.id ==
                secondData.player.find((player) => player.spPosition == 27)
                  ?.spId
            )?.name,
            spRating: secondData.player.find(
              (player) => player.spPosition == 27
            )?.status.spRating,
          },
        ],
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
