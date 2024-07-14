import { fruits } from './categories/fruits';
import { calculateAverage, initializeVotedTiers } from './helper';

const port = 8080;

let timer = 30;

let votedTiers = initializeVotedTiers();

type Tiers = {
  readonly [key in 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F']: string[];
};

export type States =
  | 'MENU'
  | 'LOBBY'
  | 'IN_PROGRESS'
  | 'ROUND_RESULTS'
  | 'FINAL_RESULTS';

export type Actions =
  | 'JOIN'
  | 'START'
  | 'VOTE'
  | 'NEXT'
  | 'TIMER_END'
  | 'SHOW_FINAL_RESULTS'
  | 'RETURN_TO_MENU';

const stateTransitions: {
  [State in States]: Partial<{ [Action in Actions]: States }>;
} = {
  MENU: { JOIN: 'LOBBY' },
  LOBBY: { START: 'IN_PROGRESS' },
  IN_PROGRESS: { VOTE: 'IN_PROGRESS', TIMER_END: 'ROUND_RESULTS' },
  ROUND_RESULTS: { NEXT: 'IN_PROGRESS', SHOW_FINAL_RESULTS: 'FINAL_RESULTS' },
  FINAL_RESULTS: { RETURN_TO_MENU: 'MENU' },
};

function getNextState(state: States, action: Actions): States {
  return stateTransitions[state][action] ?? state;
}

function isValidAction(state: States, action: Actions) {
  return stateTransitions[state][action] !== undefined;
}

let currentState: States = 'MENU';

const tiers: Tiers = {
  S: [],
  A: [],
  B: [],
  C: [],
  D: [],
  E: [],
  F: [],
};

// I don't love these floating globals
const category = 'fruits';
let items;
switch (category) {
  case 'fruits':
    items = fruits;
    break;
  default:
    throw new Error('Unknown category');
}

const gameState: {
  index: number;
  items: string[];
  roundInProgress: boolean;
  end: boolean;
} = {
  index: 0,
  items,
  roundInProgress: false,
  end: false,
};

const server = Bun.serve({
  port,
  fetch(req, server) {
    // upgrade the request to a WebSocket
    if (server.upgrade(req)) {
      return; // do not return a Response
    }
    return new Response('Upgrade failed', { status: 500 });
  },
  websocket: {
    open(ws) {
      ws.subscribe('the-group-chat');
      server.publish(
        'the-group-chat',
        JSON.stringify({
          type: 'join',
          data: {
            state: currentState,
            selection: gameState.items[gameState.index],
            timer: timer.toString(),
            results:
              gameState.end ||
              (!gameState.roundInProgress &&
                gameState.index === items.length - 1)
                ? tiers
                : votedTiers,
            // what round is it
            round: gameState.index,
            // it's possible that they're joining when showing the results
            roundInProgress: gameState.roundInProgress,
            showResults:
              gameState.end ||
              (!gameState.roundInProgress && gameState.index > 0),
            end:
              gameState.end ||
              (!gameState.roundInProgress &&
                gameState.index === items.length - 1),
            average:
              !gameState.roundInProgress && gameState.index > 0
                ? calculateAverage(votedTiers)
                : null,
          },
        })
      );
    },
    message(ws, message) {
      const data = JSON.parse(message);
      console.log('data: ', data);
      switch (data.type) {
        case 'join': {
          if (!isValidAction(currentState, 'JOIN')) {
            console.log(`Invalid action: JOIN for state ${currentState}`);
            return; // Ignore invalid actions
          }
          currentState = getNextState(currentState, 'JOIN');
          server.publish(
            'the-group-chat',
            JSON.stringify({
              type: 'state',
              data: {
                state: currentState,
              },
            })
          );
          break;
        }
        case 'start': {
          if (!isValidAction(currentState, 'START')) {
            console.log(`Invalid action: JOIN for state ${currentState}`);
            return; // Ignore invalid actions
          }
          currentState = getNextState(currentState, 'START');
          startTimer({
            timeInSeconds: 30,
            callbackAtFinish: () => {
              currentState = getNextState(currentState, 'TIMER_END');
              gameState.roundInProgress = false;
              server.publish(
                'the-group-chat',
                JSON.stringify({
                  results: {
                    fruit: gameState.items[gameState.index],
                    average: calculateAverage(votedTiers),
                    showResults: true,
                  },
                })
              );
              const average = calculateAverage(votedTiers);
              if (!average) throw new Error('No average');
              tiers[average].push(gameState.items[gameState.index]);
            },
            callbackEverySecond: (time) => {
              server.publish(
                'the-group-chat',
                JSON.stringify({ time: time.toString() })
              );
            },
          });

          server.publish(
            'the-group-chat',
            JSON.stringify({
              start: true,
              fruit: gameState.items[gameState.index],
            })
          );
          break;
        }
        case 'next': {
          if (!isValidAction(currentState, 'NEXT')) {
            console.log(`Invalid action: NEXT for state ${currentState}`);
            return; // Ignore invalid actions
          }
          currentState = getNextState(currentState, 'NEXT');
          server.publish(
            'the-group-chat',
            JSON.stringify({
              type: 'state',
              data: {
                state: currentState,
              },
            })
          );
          gameState.roundInProgress = true;

          gameState.index++;
          votedTiers = initializeVotedTiers();

          server.publish(
            'the-group-chat',
            JSON.stringify({
              start: true,
              fruit: gameState.items[gameState.index],
              showResults: false,
            })
          );
          ws.send(JSON.stringify({ time: timer.toString() }));

          startTimer({
            timeInSeconds: 30,
            callbackAtFinish: () => {
              currentState = getNextState(currentState, 'TIMER_END');
              const average = calculateAverage(votedTiers);
              if (!average) throw new Error('No average');
              tiers[average].push(gameState.items[gameState.index]);
              if (gameState.index === items.length - 1) {
                // the end of the game
                server.publish(
                  'the-group-chat',
                  JSON.stringify({
                    type: 'end',
                    data: {
                      results: tiers,
                    },
                  })
                );
                gameState.end = true;

                return;
              }
              gameState.roundInProgress = false;
              server.publish(
                'the-group-chat',
                JSON.stringify({
                  results: {
                    fruit: gameState.items[gameState.index],
                    average: calculateAverage(votedTiers),
                    showResults: true,
                  },
                })
              );
            },
            callbackEverySecond: (time) => {
              server.publish(
                'the-group-chat',
                JSON.stringify({ time: time.toString() })
              );
            },
          });

          break;
        }

        case 'vote': {
          if (!isValidAction(currentState, 'VOTE')) {
            console.log(`Invalid action: VOTE for state ${currentState}`);
            return; // Ignore invalid actions
          }
          currentState = getNextState(currentState, 'VOTE');
          server.publish(
            'the-group-chat',
            JSON.stringify({
              type: 'state',
              data: {
                state: currentState,
              },
            })
          );
          // the person might have already voted for any tier if they have change their vote
          Object.keys(votedTiers).forEach((tier) => {
            if (
              votedTiers[tier].some(
                (person) => person.name === data.person.name
              )
            ) {
              votedTiers[tier] = votedTiers[tier].filter(
                (person) => person.name !== data.person.name
              );
            }
          });
          votedTiers[data.selection].push(data.person);
          // Broadcast the timer to all connected clients
          server.publish(
            'the-group-chat',
            JSON.stringify({ votes: votedTiers })
          );

          break;
        }
      }
    },
    close(ws) {
      const msg = `someone has left the chat`;
      ws.unsubscribe('the-group-chat');
      server.publish('the-group-chat', JSON.stringify({ message: msg }));
    },
  }, // handlers
});

function startTimer({
  timeInSeconds,
  callbackAtFinish,
  callbackEverySecond,
}: {
  timeInSeconds: number;
  callbackAtFinish: () => void;
  callbackEverySecond?: (time: number) => void;
}) {
  timer = timeInSeconds;
  const interval = setInterval(() => {
    if (timer === 0) {
      callbackEverySecond?.(timer);
      clearInterval(interval);
      callbackAtFinish();
      return;
    }
    if (callbackEverySecond) {
      callbackEverySecond(timer);
    }
    timer--;
  }, 1000);
}

console.log(`Listening on http://localhost:${port}`);
