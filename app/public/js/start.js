const start_form = document.getElementById("start-form");

start_form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const error_span = document.getElementById("error-span")
    const game_name = document.getElementById("gameName").value.trim();
    const tag_line = document.getElementById("tagLine").value.trim();

    if (!game_name || !tag_line) {
        error_span.textContent = "Please fill in both Game Name and Tagline before searching.";
        return;
    }

    error_span.textContent = "";
    try {
        let result = await fetch(`/get-player-id?game_name=${game_name}&tag_line=${tag_line}`);
        let playerInfo = await result.json();
        if (!result.ok) throw new Error(playerInfo.message || "Request failed");

        localStorage.setItem("game_name", game_name);
        localStorage.setItem("tag_line", tag_line);
        localStorage.setItem("puuid", playerInfo.puuid);
        console.log(playerInfo.message);

        window.location.href = "/home";
    } catch (err) {
        console.error(err);
        error_span.textContent = err.message;
    }
});