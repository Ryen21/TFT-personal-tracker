const axios = require("axios");
const express = require("express");
const path = require("path");
const pLimit = require("p-limit");
require('dotenv').config({ path: "../.env" })

const app = express();
const port = process.env.PORT || 3000;
const hostname = "0.0.0.0";

app.use(express.static("public"));
app.use(express.json());

const api_key = process.env.RIOT_API_KEY;
const riot_match_url = process.env.RIOT_MATCH_API_URL;
const riot_league_url = process.env.RIOT_LEAGUE_API_URL;

const cache = {
    players: {},
    matches: {},
    idMappingData: null
}

// PAGE ROUTING

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "private", "start.html"));
});

app.get("/home", (req, res) => {
    res.sendFile(path.join(__dirname, "private", "home.html"));
});

app.get("/match-history", (req, res) => {
    res.sendFile(path.join(__dirname, "private", "match-history.html"));
});

app.get("/recommender", (req, res) => {
    res.sendFile(path.join(__dirname, "private", "recommender.html"));
});

app.listen(port, hostname, () => {
    console.log(`App listening at http://localhost:${port}`);
});

// APPLICATION ENDPOINTS

// Get TFT player id
app.get("/get-player-id", async (req, res) => {
    let game_name = req.query.game_name;
    let tag_line = req.query.tag_line;

    if (!game_name || !tag_line) {
        return res.status(400).json({
            "message": "Error with request parameters. Please ensure game_name and tag_line params are included.",
            "code": 400
        });
    }

    if (cache.players[`${game_name}#${tag_line}`]) return res.json(cache.players[`${game_name}#${tag_line}`]);

    let response_body = await getPlayerId(game_name, tag_line);

    if (response_body["error"]) {
        return res.status(500).json(response_body);
    } else {
        cache.players[`${game_name}#${tag_line}`] = response_body;
        return res.json(response_body);
    }
});

// Get TFT player information based on puuuid
app.get("/get-player-information", async (req, res) => {
    let puuid = req.query.puuid;

    if (!puuid) return res.status(400).json({
        "message": "Missing puuid in query parameter",
        "code": 400
    })

    try {
        let { data } = await axios.get(`${riot_league_url}/tft/league/v1/by-puuid/${puuid}`,
            { headers: { "X-Riot-Token": api_key } }
        );
        let playerData = data[0]
        let wins = playerData.wins;
        let losses = playerData.losses;

        let returnObj = {
            gamesPlayed: wins + losses,
            completeRank: `${playerData.tier} ${playerData.rank}`,
            leaguePoints: playerData.leaguePoints,
            topFourPercent: wins / (wins + losses)
        };

        res.json(returnObj);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            "message": error.message,
            "code": 500
        })
    }
});

// Get match history for player
app.get("/get-match-history", async (req, res) => {
    let puuid = req.query.puuid;
    let count = parseInt(req.query.count) || 5;

    if (!puuid) return res.status(400).json({ 
        "message": "Missing puuid",
        "code": 400
    })

    try {
        let { data: matchIds } = await axios.get(`${riot_match_url}/tft/match/v1/matches/by-puuid/${puuid}/ids?start=0&count=${count}`,
            { headers: { "X-Riot-Token": api_key } }
        );
        
        let limit = pLimit(5);
        let matchPromises = matchIds.map(id => limit(() => getMatchDetails(id, puuid)));

        let matches = await Promise.all(matchPromises);

        return res.json(matches);
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            "message": error.message,
            "code": 500
        });
    }
});

// Post recommendations for player's history
app.post("/make-recommendations", (req, res) => {
    let matches = req.body;

    if (!matches || !Array.isArray(matches) || matches.length === 0) {
        return res.status(400).json({ 
            "message": "Body must contain an array of matches",
            "code": 400
        });
    }

    let analysis = generateRecommendations(matches, matches.length);

    res.json(analysis);
});

// UTILITY FUNCTIONS

// Get ID Name Mappings - Riot uses different ids in their APIs compared to the in game names
async function getIdMappings() {
    if (cache.idMappingData) return cache.idMappingData;

    let { data } = await axios.get("https://raw.communitydragon.org/latest/cdragon/tft/en_us.json");
    
    let unitMap = {};
    let traitMap = {};

    Object.values(data.sets).forEach(set => {
        set.champions.forEach(c => (unitMap[c.apiName] = { name: c.name, cost: c.cost }));
        set.traits.forEach(t => (traitMap[t.apiName] = t.name));
    });

    cache.staticData = { unitMap, traitMap };
    return cache.staticData;
}

// Call Riot API to get player puuid
async function getPlayerId(game_name, tag_line) {
    try {
        let response = await axios.get(`${riot_match_url}/riot/account/v1/accounts/by-riot-id/${game_name}/${tag_line}`,
            { headers: { "X-Riot-Token": api_key } }
        );
        let code = response.status;
        let message = `Successfully retreived player data for ${game_name}#${tag_line}`;
        let puuid = response.data.puuid;

        return { message, code, puuid, game_name, tag_line };
    } catch (error) {
        console.error(error);
        if (error.response && error.response.data) {
            let body = error.response.data.status || {};
            let code = body.status_cod || 500;
            let message = body.message || "Unknown error from Riot API";

            return { message, code, error: true };
        } else {
            return { message: error.message, code: 500, error: true };
        }
    }
}

// Call Riot API to get match details
async function getMatchDetails(matchId, puuid) {
    // Check if match details have already been fetched
    if (cache.matches[matchId]) return cache.matches[matchId];

    let { unitMap, traitMap } = await getIdMappings();

    try {
        let { data: match } = await axios.get(`${riot_match_url}/tft/match/v1/matches/${matchId}`,
            { headers: { "X-Riot-Token": api_key } }
        );

        let matchDetails = match.info.participants.find(p => p.puuid === puuid);
        let datetime = new Date(match.info.game_datetime);

        let finalDetails = {
            matchId,
            datetime: datetime.toISOString(),
            placement: matchDetails.placement,
            level: matchDetails.level,
            goldLeft: matchDetails.gold_left,
            traits: (matchDetails.traits || [])
                .filter(t => t.style > 0)
                .map(t => ({ name: traitMap[t.name] || t.name, units: t.num_units })),
            units: (matchDetails.units || [])
                .map(u => {
                    const unitData = unitMap[u.character_id] || {};
                    return {
                        name: unitData.name || u.character_id,
                        tier: u.tier || 1,
                        cost: unitData.cost || 0,
                        items: u.items || []
                    };
                }),
            damageDealt: matchDetails.total_damage_to_players,
            lastRound: matchDetails.last_round
        }
        cache.matches[matchId] = finalDetails;
        return finalDetails;
    } catch (error) {
        console.error(error);
        return { matchId, error: true, message: error.message };
    }
}

// Analyze games to make recommendations and improve gameplay
function generateRecommendations(matches) {
    let totalPlacement = 0;
    let top4Count = 0;
    let totalLevel = 0;
    let totalGold = 0;

    const traitCounter = {};
    const unitCounter = {};

    matches.forEach(match => {
        totalPlacement += match.placement;
        if (match.placement <= 4) top4Count++;

        totalLevel += match.level;
        totalGold += match.goldLeft;

        match.traits.forEach(trait => {
            traitCounter[trait.name] = (traitCounter[trait.name] || 0) + 1;
        });

        match.units.forEach(unit => {
            unitCounter[unit.name] = (unitCounter[unit.name] || 0) + 1;
        });
    });

    const avgPlacement = (totalPlacement / matches.length).toFixed(2);
    const top4Percent = ((top4Count / matches.length) * 100).toFixed(1);
    const avgLevel = (totalLevel / matches.length).toFixed(2);
    const avgGold = (totalGold / matches.length).toFixed(1);

    const mostUsedTraits = Object.entries(traitCounter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

    const mostUsedUnits = Object.entries(unitCounter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    const recommendations = [];

    if (avgPlacement > 4) recommendations.push("Try to stabilize your early game to reach top 4 more consistently.");
    if (avgGold < 10) recommendations.push("Consider saving more gold for stronger level-ups and rounds.");
    if (avgLevel < 7) recommendations.push("Focus on leveling up slightly faster to unlock stronger units.");

    recommendations.push(
        `Your most frequent traits: ${mostUsedTraits.map(t => t.name).join(", ")}.`,
        `Your most frequent units: ${mostUsedUnits.map(u => u.name).join(", ")}.`
    );

    return {
        avgPlacement,
        top4Percent,
        avgLevel,
        avgGold,
        mostUsedTraits,
        mostUsedUnits,
        recommendations
    };
}