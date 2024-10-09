// old bot interface from Supabase
// https://tzfpareyqnzunyzjudud.supabase.co/functions/v1/hello-world/interactions
// domain/url
// https://qvps.xbsx.au/webhook

//// BakerStaunch
//// This (untested) code probably covers the common cases: 
// import fs from "fs";
// Object.assign(
//   process.env,
//   Object.fromEntries(
//     fs.readFileSync('./.env').split('\n').map(
//       line => line.trim()
//     ).filter(line => line && !line.startsWith('#')).map(
//       line => {
//         let [key, ...value] = line.split('=');
//         return [key, value.join('=')]
//       }
//     )
//   )
// )

import 'dotenv/config'
import express from "express";
import {
  verifyKey,
  InteractionType,
  InteractionResponseType
} from "discord-interactions";
import {
  discord_interact,
  discord_command
} from "./discord-bot/Discord-Bot.mjs"

////https stuff, keep for reference?
// const fs      = require('fs');
// import { readlink } from 'fs';
// const https   = require('https');
// const options = {
//   key:  fs.readFileSync('../../server.key'),
//   cert: fs.readFileSync('../../server.crt')
// };
// const httpsServer = https.createServer(options, (req, res)=>{
//   res.writeHead(200);
//   res.end('Hellorld!');
// });
// const httpServer = http.createServer((req, res)=>{
//   res.writeHead(301,
//     {Location: `https://${req.headers.host}${req.url}`}
//   );
//   res.end();
// });
// httpServer.listen(80);
// httpsServer.listen(443);
// https.createServer(app).listen(process.env.PORT || 8080, listen);

const Express = express();
const PORT = process.env.PORT || 8080;
Express.listen(PORT, ()=>console.log(`Server is running on port ${PORT}`));
Express.use(express.json());

// function listen() {
//   console.log(`Server is running on port ${PORT}`);
// }

// we're listening for "POST" requests
//at "/webhook" URL/URI?
Express.post('/webhook', async (req, res) => {
  let rawBody = req.body;

  const {valid} = await verifySignature(rawBody, req);
  // console.log("valid: ", valid);
  if (!valid) {
    return new Response(
      JSON.stringify(
        { error: 'Invalid request: Signature not verified' }
      ),
      { status: 401, }
    )
  }

  //pull the relevant data from req
  const { type, } = rawBody;

  // console.log("rawBody: ", rawBody);

  if (type == InteractionType.PING) {
    return res.send({
      type: InteractionResponseType.PONG
    })
  }

  //  * Handle App Button clicks
  if (type === InteractionType.MESSAGE_COMPONENT) {
    res.status(200).json(await discord_interact(rawBody));
  }
  //  * Handle slash command requests
  if (type === InteractionType.APPLICATION_COMMAND) {
    res.status(200).json(await discord_command(rawBody));
  }
});

//for websight viewing?
Express.get('/webhook', (req, res)=>{
  res.send('\n\This will eventually point to the website.\n For now: https://quantumapprentice.github.io/Movie-Tracker/\n');
});



// verifySignature() verifies if the request is coming from Discord.
// When the request's signature is not valid, we return a 401 and this is
// important as Discord sends invalid requests to test our verification.
async function verifySignature(rawBody, req) {
  // Discord sends these headers with every request.
  const signature = req.headers['x-signature-ed25519']   ?? '';
  const timestamp = req.headers['x-signature-timestamp'] ?? '';

  const PUBLIC_KEY = process.env.PUBLIC_KEY;
  const isValidRequest = await verifyKey(JSON.stringify(rawBody), signature, timestamp, PUBLIC_KEY);

  return {
    valid: isValidRequest,
  };
}