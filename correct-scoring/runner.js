import data from './results.json' with {type: 'json'};
import teams from './players.json' with {type: 'json'};

const teamNamesByParentId = teams.reduce((acc, {id, name}) => {
    acc[id] = name;
    return acc;
}, {});

const teamNamesById = data.players.reduce((acc, {player: {id, parentId}}) => {
    acc[id] = teamNamesByParentId[parentId];
    return acc;
}, {});

const playerScores = data.matches.map(({gameDetailsDto : { players }}) => players.reduce((acc, {playerId, place}) => {
    if (!acc[place]) {
        acc[place] = [playerId];
    } else {
        acc[place].push(playerId);
    }
    return acc;
}, [])).map(game => game.filter(playerIds => playerIds.length > 0));

const rankByPlayer = playerScores.reduce((acc, game) => {
    game.forEach((playerIds, index) => {
        playerIds.forEach(playerId => {
            const teamName = teamNamesById[playerId];
            if (!acc[teamName]) {
                acc[teamName] = [0,0,0,0];
            }
            acc[teamName][index] += 1; // index + 1 because ranks start at 1
        });
    });
    return acc;
}, {})

const sortedTeams = Object.entries(rankByPlayer).sort((a, b) => {
    const [aName, aScores] = a;
    const [bName, bScores] = b;
    return bScores[0] - aScores[0] || bScores[1] - aScores[1] || bScores[2] - aScores[2] || bScores[3] - aScores[3];
});

// const updatedScores = playerScores.map(game => )

console.log(teamNamesById);
console.log(rankByPlayer);
console.log(sortedTeams);