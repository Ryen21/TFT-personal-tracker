const count_form = document.getElementById("match-count-form");
const count_select = document.getElementById("match-count");
const match_container = document.getElementById("match-history-container");
const error_span = document.getElementById("error-span");

async function loadMatchHistory(count = 5) {
    match_container.innerHTML = "";
    error_span.textContent = "";

    let puuid = localStorage.getItem("puuid");
    if (!puuid) {
        error_span.textContent = "Missing puuid from request";
        return;
    }

    try {
        let result = await fetch(`/get-match-history?puuid=${puuid}&count=${count}`);
        let matchData = await result.json();
        if (!result.ok) throw new Error(matchData.message || "Request Failed");

        matchData.sort((a,b) => new Date(b.datetime) - new Date(a.datetime));

        matchData.forEach(match => {
            const match_card = document.createElement("div");
            match_card.classList.add("match-card");

            match_card.innerHTML = `
                <!-- Header -->
                <div class="match-card-header">
                    <span>Match: ${match.matchId}</span>
                    <span>${new Date(match.datetime).toLocaleString()}</span>
                </div>

                <!-- Core stats -->
                <div class="match-stats">
                    <span>Placement: ${match.placement}</span>
                    <span>Level: ${match.level}</span>
                    <span>Gold: ${match.goldLeft}</span>
                    <span>Last Round: ${match.lastRound}</span>
                    <span>Damage: ${match.damageDealt}</span>
                </div>

                <!-- Traits -->
                <div class="traits">
                    ${match.traits.map(t => `<span class="trait">${t.name} (${t.units})</span>`).join('')}
                </div>

                <!-- Units -->
                <div class="units">
                    ${match.units.map(u => {
                        const stars = '★'.repeat(u.tier);
                        return `<span class="unit tier-${u.cost}">${u.name} ${stars}</span>`;
                    }).join('')}
                </div>
            `;

            match_container.appendChild(match_card);
        });
    } catch (error) {
        console.error(error);
        error_span.textContent = error.message || "Failed to load match history";
    }
}

loadMatchHistory();

count_form.addEventListener("submit", event => {
    event.preventDefault();
    const count = parseInt(count_select.value);
    loadMatchHistory(count);
});

document.getElementById("reset-link").addEventListener("click", event => {
    localStorage.clear();
});