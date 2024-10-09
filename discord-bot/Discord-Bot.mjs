import tmdbJson from '../../Movie-Tracker/src/tmdbList.json'  assert {type: 'json'};
import listJson from '../../Movie-Tracker/src/movieList.json' assert {type: 'json'};

// let tmdbJson, listJson;
// export function init_ata(_tmdbJson, _listJson)
// {
//   tmdbJson = _tmdbJson;
//   listJson = _listJson;
// }

import {
  vote_tally,
  get_top_five,
  remove_vote,
  add_vote,
} from "./SQLite-database.mjs"
import {
  InteractionType,
  InteractionResponseType
} from "discord-interactions";


export async function discord_interact(rawBody)
{
  //pull the relevant data from request
  const { type,
          id: interaction_id,
          token: interaction_token,
          data,
          member,
  } = rawBody;
  const { component_type,
          custom_id
  } = data;
  let btn_index = custom_id.split('-');
  let new_index = Number(btn_index[1]);

  switch (btn_index[0]) {
    case "next":
      //loop up through tmdb array
      //if at end circle back
      new_index = new_index+1 >= tmdbJson.length ? 0 : new_index+1;
      break;

    case "prev":
      //loop down through tmdb array
      //if at end circle back
      new_index = new_index-1 < 0 ? tmdbJson.length-1 : new_index-1;
      break;

    case "vote": {
      const {id, title} = tmdbJson[btn_index[1]];
      if (id) {
        return vote_for_movie(id.toString(), member.user.id, title);
      }
      break;
    }

    case "remove_vote": {
      const {id, title} = tmdbJson[btn_index[1]];
      if (id) {
        return remove_movie_vote(id.toString(), member.user.id, title);
      }
      break;
    }

    case "watched": {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: ""
        }
      }
    }
    default:
  }

  // let stat = await browse_movies(
  //   interaction_id,
  //   interaction_token,
  //   new_index,
  //   InteractionResponseType.UPDATE_MESSAGE
  // );
  // res.status(200).json(
  //   stat
  // );

  return browse_movies(
    new_index,
    InteractionResponseType.UPDATE_MESSAGE
  );
}

export async function discord_command(rawBody)
{
  const { type,
          id: interaction_id,
          token: interaction_token,
          data,
          member,
  } = rawBody;

  //  * Handle slash command requests
  //  * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
  const {name} = data;
  if (name === 'clear') {
    return clear_board(rawBody.channel.id);
  }

  if (name === 'top5') {
    return show_top_five(rawBody.channel.id);
  }

  const movieID = data?.options?.[0].value;
  if (name === 'browse') {
    let new_index = 0;
    if (movieID) {
      new_index = tmdbJson?.findIndex(m=>m.id == movieID);
    }
    // console.log("movie index: ", new_index);
    if (new_index > -1) {
      return browse_movies(
        new_index,
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
      );
    }
  }

  //handle bot commands that interact w/database
  const movie_name = tmdbJson?.find(m=>m.id == movieID)?.title;
  if (movie_name) {
    if (name === 'vote') {
      const userID = member.user.id;
      return vote_for_movie(movieID, userID, movie_name);
    }
    if (name === 'tally') {
      return tally_movie_votes(movieID, movie_name);
    }
  } else {
    return default_response();
  }

  return ({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "I'm sorry Dave, I can't do that." + getRandomEmoji()
    }
  });
}

async function clear_board(channelID)
{
  // API endpoint to overwrite global commands
  const endpoint = `channels/${channelID}/messages`;
  try {
    //append endpoint to root URL for Discord API
    const url = 'https://discord.com/api/v10/' + endpoint;
    //use node-fetch to make requests
    const res = await fetch(
      url,
      {headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },}
    );
    if (!res.ok) {
      const data = await res.json();
      console.log("data: ", data);
      throw new Error("Error in clear_board():\n", JSON.stringify(data));
    }

    //TODO: how do I handle delete_msgs() await
    //      if the timeout() gets called?
    const temp_arr = await res.json();
    await delete_msgs(temp_arr, channelID);
    return show_top_five(channelID);

    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    // await DiscordRequest(endpoint, { method: 'GET' });
  } catch (err) {
    console.error(err);
  }
}

async function delete_msgs(msg_arr, channelID)
{
  for (const msg of msg_arr) {
    // console.log("msg-id: ", msg.id);
    const del_end = `channels/${channelID}/messages/${msg.id}`;
    const del_url = `https://discord.com/api/v10/${del_end}`;
    const del_res = await fetch(del_url, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
      },
    });

    if (del_res.headers.get("x-ratelimit-remaining") == "0") {
      const wait_time_ms = Number(del_res.headers.get("x-ratelimit-reset-after"))*1000;
      console.log("wait_time_ms: ", wait_time_ms);
      await new Promise(resolve=>setTimeout(resolve, wait_time_ms));
    }
  }
}

async function show_top_five(channelID)
{
  const top5 = await get_top_five();
  // console.log("top5: ", top5);

  for (const el of top5) {
    const movie = tmdbJson?.find(m=>m.id == el.movieID);
    const list  = listJson?.find(m=>m.dbid == el.movieID);
    // const tally = await vote_tally(movie?.id);

    //generate movie listing with trailer if possible
    let trailers= "";
    if (list?.links.trailer) {
      for (const tr of list.links.trailer) {
        trailers += `trailer: ${tr}\n`;
      }
    }
    const year = movie?.release_date?.slice(0,4);
    const temp = `${movie?.title} (${year}) [${movie?.runtime_hm}] ${el.tally > 0 ? "👍x"+el.tally : ""}\
                \n${trailers}\n`;

    const post_endpoint = `channels/${channelID}/messages`;
    const post_url = 'https://discord.com/api/v10/' + post_endpoint;
    await fetch(
      post_url, {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json; charset=UTF-8',
        // 'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
      },
      body: JSON.stringify({"content": temp})
    }).then(res=>{
      // log API errors
      if (!res.ok) {
        console.log("POST status: ", res.status);
        console.log("Show Top 5 Full error message: ", res.body);
      }
    });
  }

  return ({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "Top 5 Voted Movies:",
    }
  });

  // return new Response(
  //   JSON.stringify({
  //     type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  //     data: {
  //       content: "Top 5 Voted Movies:",
  //     }
  //   }),
  //   {headers: {"Content-Type": "application/json"}}
  // );
}

function default_response()
{
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "Sorry that's a wrong number. Please hang up and dial again!" + getRandomEmoji(),// + <@userID>,
    }
  }
}

async function tally_movie_votes(movieID, movie_name)
{
  const tally = await vote_tally(movieID);
  // console.log("tally: ", tally);
  return ({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `${movie_name} has ${tally} votes!` + getRandomEmoji()
    }
  });
}

async function remove_movie_vote(movieID, userID, title)
{
  const success = await remove_vote(movieID, userID);
  // console.log("removing vote: ", success);

  if (success == false) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "You didn't vote for " + title + " " + getRandomEmoji()
      }
    }
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'You have removed your vote for ' + title + " " + getRandomEmoji(), // + <@userID>,
    }
  }
}

async function vote_for_movie(movieID, userID, movie_name)
{
  const success = await add_vote(userID, movieID);

  if (success == false) {
    return ({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        // Fetches a random emoji to send from a helper function
        content: `You already voted for ${movie_name}, stop wasting my time!` + getRandomEmoji(),// + <@userID>,
      }
    });
  }

  const tally = await vote_tally(movieID);
  // Send a message into the channel where command was triggered from
  return ({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      // Fetches a random emoji to send from a helper function
      content: 'You have voted for ' + movie_name + ", which now has " + tally + " votes." + getRandomEmoji(),// + <@userID>,
    }
  });
}

async function browse_movies(movieIDX, res_type)
{
  const movie = tmdbJson[movieIDX ?? 0];
  const list  = listJson?.find(m=>m.dbid == movie.id);
  let trailrs = "";
  if (list?.links.trailer) {
    for (const tr of list.links.trailer) {
      trailrs += `trailer: ${tr}\n`;
    }
  }
  const year  = movie?.release_date?.slice(0,4);
  const tally = await vote_tally(movie.id?.toString());
  const movie_listing = `${movie?.title} (${year}) [${movie.runtime_hm}] ${tally > 0 ? "👍x"+tally : ""}\
                        \n${trailrs}\n`;
  const movie_link = movie?.poster?.slice(0,-4);
  let watchedate;
  if (list?.watched) {
    watchedate = list?.watchdate;
  }
  console.log("\n\nwatched: ", watchedate);
  console.log('\nmovie: ', list);
  // const post_url = `https://discord.com/api/v10/interactions/${interaction_id}/${interaction_token}/callback`;
  // let res = await fetch(
  return ({
        type: res_type,
        data: {
          title: "This won't show up anywhere...but I have to double check.",
          custom_id: 'movie_search',
          content: movie_listing,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: 'Add vote 👍',
                  style: 1,
                  custom_id: `vote-${movieIDX}`,
                },
                {
                  type: 2,
                  label: 'Remove vote 👎',
                  style: 4,
                  custom_id: `remove_vote-${movieIDX}`,
                },
                {
                  type: 2,
                  label: 'Website',
                  style: 5,
                  url: `https://quantumapprentice.github.io/Movie-Tracker/movies/${movie_link}`,
                },
              ]
            },
            {
              type: 1,        // 1 == action row
              components: [{
                  type: 2,      // 2 == button, 4 == text input
                  label: '◀️',
                  style: 1,
                  custom_id: `prev-${movieIDX}`,
                },
                {
                  type: 2,
                  label: '▶️',
                  style: 1,
                  custom_id: `next-${movieIDX}`,
                },
                {
                  type: 2,
                  label: `Last Watched: ${watchedate}`,
                  style: 1,
                  custom_id: `watched`,
                }
              ]
            }
          ]
        }
  });
  // );
  // if (!res.ok) {
  //   console.log("POST status: ", res.status);
  //   console.log("error body: ", await res.json());
  //   // console.log("stuff: ", res.headers);
  // }
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}
