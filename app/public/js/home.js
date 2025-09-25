const player_card = document.getElementById("player-card");
const error_span = document.getElementById("error-span");

document.addEventListener("DOMContentLoaded", async (req, res) => {
    let puuid = localStorage.getItem("puuid");
    if (!puuid) {
        error_span.textContent = "You shouldn't be here yet. Please search for a player first.";
        return;
    }

    try {
        let result = await fetch(`/get-player-information?puuid=${puuid}`);
        let playerData = await result.json();
        if (!result.ok) throw new Error(playerData.message || "Request failed");

        error_span.textContent = "";
        let player_name = `${localStorage.getItem("game_name")}#${localStorage.getItem("tag_line")}`;
        let games_played = playerData.gamesPlayed;
        let rank = playerData.completeRank;
        let lp = playerData.leaguePoints;
        let top_four_percent = playerData.topFourPercent;

        document.getElementById("player-name").textContent = player_name;
        document.getElementById("games-played").textContent = `Games Played: ${games_played}`;
        document.getElementById("rank").textContent = `Rank: ${rank}`;
        document.getElementById("lp").textContent = `LP: ${lp}`;
        document.getElementById("top-four").textContent = `Top 4: ${(top_four_percent * 100).toFixed(1)}%`;
    } catch (error) {
        console.error(error);
        error_span.textContent = error.message;
    }
});

document.getElementById("reset-link").addEventListener("click", event => {
    localStorage.clear();
});