const rec_form = document.getElementById("rec-count-form");
const rec_select = document.getElementById("rec-count");
const rec_container = document.getElementById("recommendation-container");
const error_span = document.getElementById("error-span");

rec_form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const count = parseInt(rec_select.value);

  try {
    const puuid = localStorage.getItem("puuid");
    if (!puuid) throw new Error("Please go back to the start screen to get a valid puuid");

    let result = await fetch(`/get-match-history?puuid=${puuid}&count=${count}`);
    let matchData = await result.json();
    if (!result.ok) throw new Error(matchData.message || "Request for Matches Failed");

    const response = await fetch("/make-recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchData)
    });
    let rec_data = await response.json();
    if (!response.ok) throw new Error(rec_data.message || "Request for Recs Failed");

    const card = document.createElement("div");
    card.className = "recommendation-card";
    card.innerHTML = `
      <h2>Recommended Tips</h2>

      <div class="stats">
        <span>Avg Placement: ${rec_data.avgPlacement}</span>
        <span>Top 4 %: ${rec_data.top4Percent}</span>
        <span>Avg Level: ${rec_data.avgLevel}</span>
        <span>Avg Gold: ${rec_data.avgGold}</span>
      </div>

      <div>
        <strong>Most Used Traits:</strong>
        <ul>
          ${rec_data.mostUsedTraits.map(t => `<li>${t.name} (${t.count} games)</li>`).join('')}
        </ul>
      </div>

      <div>
        <strong>Most Used Units:</strong>
        <ul>
          ${rec_data.mostUsedUnits.map(u => `<li>${u.name} (${u.count} games)</li>`).join('')}
        </ul>
      </div>

      <div>
        <strong>Recommendations:</strong>
        <ul>
          ${rec_data.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    `;

    // Clear old card and append new one
    rec_container.innerHTML = "";
    rec_container.appendChild(card);

  } catch (err) {
    console.error(err);
    rec_container.innerHTML = `<p style="color:red; text-align: center;">Error fetching recommendations: ${err.message}</p>`;
  }
});

document.getElementById("reset-link").addEventListener("click", event => {
    localStorage.clear();
});