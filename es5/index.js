const express = require("express");
const request = require("request");
const cors = require("cors");
const fetch = require("node-fetch");
const dotenv = require("dotenv");

const app = express();

const whitelist = ["https://fistory.online"];
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
  res.json({ message: error.message });
});

dotenv.config({ path: "./.env" });

const apiUrl = "https://api.nexon.co.kr/fifaonline4/v1.0";
const HEADER = {
  Authorization: process.env.API_KEY,
};

app.get("/matchids", (req, res) => {
  const firstInput = req.query.first;
  const secondInput = req.query.second;

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
                var noMatchUser = [false, false];
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
                      .then(response => response.json())
                      .then(body => {
                        if (body.length === 0) {
                          if (offset == 0) {
                            noMatchUser[accessIds.findIndex(id => id == userId)] = true;
                            noMatch = true;
                          }
                          endMatch = true;
                        } else {
                          matchIds.push(...body);
                          offset += 100;
                        }
                      });
                  }
                }
                if (matchIds.length === 0) {
                  if (noMatchUser[0] && noMatchUser[1]) {
                    res.json({ message: "No last matches" });
                  } else if (noMatchUser[0]) {
                    res.json({
                      message: `No matches user0`,
                      userInfo: { nickname: originalNickname },
                    });
                  } else {
                    res.json({
                      message: `No matches user1`,
                      userInfo: { nickname: originalNickname },
                    });
                  }
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
    }).then(response => response.json());
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
      accessIds.find(id => id == matchInfo[0].accessId) &&
      accessIds.find(id => id == matchInfo[1].accessId)
    ) {
      totalMatch++;
      const firstData = matchInfo[matchInfo[0].accessId == accessIds[0] ? 0 : 1];
      const secondData = matchInfo[matchInfo[0].accessId == accessIds[1] ? 0 : 1];

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
        shootOut: firstData.shoot.shootOutScore > 0 || secondData.shoot.shootOutScore > 0,
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
    .then(response => response.json())
    .then(data => {
      const matchInfo = data.matchInfo;
      const firstData = matchInfo[matchInfo[0].nickname == firstNick ? 0 : 1];
      const secondData = matchInfo[matchInfo[0].nickname == firstNick ? 1 : 0];
      let firstPlayers = [];
      let secondPlayers = [];

      for (let i = 0; i < 28; i++) {
        let playerData = firstData.player.find(player => player.spPosition == i);
        let spId = playerData && playerData.spId;
        let playerInfoData = playerInfo.find(player => player.id == spId);
        let spName = playerInfoData && playerInfoData.name;
        let spStatus = playerData && playerData.status;
        let spRating = spStatus && spStatus.spRating;
        let spGoal = spStatus && spStatus.goal;
        firstPlayers.push({
          spName,
          spRating,
          spGoal,
        });
      }
      for (let i = 0; i < 28; i++) {
        let playerData = secondData.player.find(player => player.spPosition == i);
        let spId = playerData && playerData.spId;
        let playerInfoData = playerInfo.find(player => player.id == spId);
        let spName = playerInfoData && playerInfoData.name;
        let spStatus = playerData && playerData.status;
        let spRating = spStatus && spStatus.spRating;
        let spGoal = spStatus && spStatus.goal;
        secondPlayers.push({
          spName,
          spRating,
          spGoal,
        });
      }

      res.json({
        firstRating: ((firstData.matchDetail.averageRating * 18) / 11).toFixed(1),
        firstPlayers,
        secondRating: ((secondData.matchDetail.averageRating * 18) / 11).toFixed(1),
        secondPlayers,
      });
    });
});

app.listen(3000, () => {
  console.log("API listening on port 3000");
});
