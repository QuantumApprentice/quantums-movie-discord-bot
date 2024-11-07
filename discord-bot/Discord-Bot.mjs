import tmdbJson from '../../Movie-Tracker/src/tmdbList.json'  assert {type: 'json'};
import listJson from '../../Movie-Tracker/src/movieList.json' assert {type: 'json'};

// let tmdbJson, listJson;
// export function init_ata(_tmdbJson, _listJson)
// {
//   tmdbJson = _tmdbJson;
//   listJson = _listJson;
// }

// import {
//   vote_tally,
//   get_top_five,
//   remove_vote,
//   add_vote,
// } from "./SQLite-database.mjs"
import {
  vote_tally,
  get_top_five,
  remove_vote,
  add_vote,
  user_voted,
  user_movies,
} from "./postGRES-database.mjs";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags
} from "discord-interactions";

//handle buttons from discord interaction object
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
  let srch_str;

  // console.log("rawBody: ", rawBody);

  switch (btn_index[0]) {
    case "search":
      // console.log("modal running");
      return search_modal(new_index);

    case "next":
      //loop up through tmdb/search array
      //if at end circle back
      // console.log("rawbody.message.components[0].components: ", rawBody.message.components[0].components);
      srch_str = rawBody.message.components[1].components.find((q)=>{
        return (q.label.startsWith("Search:"));
      })?.label.split(' ').slice(1).join(' ');
      // console.log("next search? ", srch_str);
      // console.log("next new_index? ", new_index);

      if (srch_str) {
        new_index = movie_search(srch_str, new_index, "next");
      } else {
        new_index = new_index+1 >= tmdbJson.length ? 0 : new_index+1;
      }
      break;

    case "prev":
      //loop down through tmdb array
      //if at end circle back to start
      srch_str = rawBody.message.components[1].components.find((q)=>{
        return (q.label.startsWith("Search:"));
      })?.label.split(' ').slice(1).join(' ');
      // console.log("prev search? ", srch_str);
      // console.log("prev new_index? ", new_index);

      if (srch_str) {
        new_index = movie_search(srch_str, new_index, "prev");
      } else {
        new_index = new_index-1 < 0 ? tmdbJson.length-1 : new_index-1;
      }
      break;

    case "vote": {
      const {id, title} = tmdbJson[btn_index[1]];
      if (id) {
        await add_vote(member.user.id, id.toString());
        // return vote_for_movie(id.toString(), member.user.id, title);
      }
      break;
    }

    case "remove_vote": {
      const {id, title} = tmdbJson[btn_index[1]];
      if (id) {
        await remove_vote(member.user.id, id.toString());
        // return remove_movie_vote(id.toString(), member.user.id, title);
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

  const voted = await user_voted(member.user.id, tmdbJson[new_index > -1 ? new_index : 0].id);

  return browse_movies(
    new_index,
    srch_str,
    InteractionResponseType.UPDATE_MESSAGE,
    voted,
  );
}

//slash commands directly from discord chat
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

  // //TODO: implement browse by movie id
  //      instead of by name
  if (name === 'id-browse') {
    // const movieID = data?.options?.[0].value;
    // if (movieID) {
    //   new_index = tmdbJson?.findIndex(m=>m.id == movieID);
    // }
  }

  // //TODO: implement vote/tally/unvote by id
  // //      instead of by name
  // //handle bot commands that interact w/database
  // const movie_name = tmdbJson?.find(m=>m.id == movieID)?.title;
  // if (movie_name) {
  //   if (name === 'vote') {
  //     const userID = member.user.id;
  //     return vote_for_movie(movieID, userID, movie_name);
  //   }
  //   if (name === 'tally') {
  //     return tally_movie_votes(movieID, movie_name);
  //   }
  //   if (name === 'unvote') {
  //     return remove_movie_vote(movieID, movie_name);
  //   }
  // } else {
  //   return default_response();
  // }

  //if no search is provided, default browse is index 0 in tmdbJson
  //if search is not found, -1 is returned from search, and response is "can't find movie"
  //else search index is returned
  if (name === 'browse') {
    let new_index;

    const search_str = data?.options?.[0].value;
    // console.log("browse search: ", search_str);
    if (search_str) {
      new_index = movie_search(search_str);
    } else {
      new_index = 0;
    }
    const voted = await user_voted(member.user.id, tmdbJson[new_index > -1 ? new_index : 0].id);
    // console.log("movie new_index: ", new_index);
    if (new_index > -1) {
      return browse_movies(
        new_index,
        search_str,
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        voted,
      );
    } else {
      return default_response("Sorry, I couldn't find that movie...😭");
    }
  }

  if (name === "random") {
    const new_index = Math.floor(Math.random()*listJson.length);
    const voted = await user_voted(member.user.id, tmdbJson[new_index > -1 ? new_index : 0].id);
    return browse_movies(
      new_index,
      '',
      InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      voted,
    );
  }

  if (name === "vote-history") {
    const movies = await user_movies(member.user.id);
    let output = "You voted for:\n";
    for (const el of movies) {
      const movie = tmdbJson?.find(m=>m.id == el.movieid);
      const tally = await vote_tally(el.movieid);

      const year = movie?.release_date?.slice(0,4);
      output += `${movie?.title} (${year}) [${movie?.runtime_hm}] has ${tally > 0 ? "👍x"+tally : ""} total votes\n`;
    }
    // console.log("output: ", output);

    return ({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: output,
        flags: InteractionResponseFlags.EPHEMERAL,
      }
    });
  }

  return ({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "I'm sorry Dave, I can't do that." + getRandomEmoji(),
      flags: InteractionResponseFlags.EPHEMERAL,
    }
  });
}

export async function discord_modal(rawBody)
{
  const { type,
          id: interaction_id,
          token: interaction_token,
          data,
          member,
          message,
  } = rawBody;


  // console.log("data: ", data.components[0].components[0].value);
  const search_str = data.components[0].components[0].value;
  // console.log("search_str: ", search_str);
  let new_index;
  if (search_str) {
    new_index = movie_search(search_str);
  }
  else {
    new_index = message.components[0].components[0].custom_id.split("-")[1];
  }
  const voted = await user_voted(member.user.id, tmdbJson[new_index > -1 ? new_index : 0].id);

  if (new_index > -1) {
    return browse_movies(
      new_index,
      search_str,
      InteractionResponseType.UPDATE_MESSAGE,
      voted,
    );
  } else {
    return default_response("Sorry, I couldn't find that movie...😭");
  }
}

//search pop-up for discord search button
function search_modal(index)
{
  const random_movie = [
    "Star Wars", "Ninja Turtles", "Fight Club",
    "Matrix", "Lord of the Rings",
    "Indiana Jones", "Ghostbusters",
    "Friday the 13th", "Nightmare on Elm Street",
  ];
  const random_placeholder = random_movie[Math.floor(Math.random()*random_movie.length)]

  return ({
    type: InteractionResponseType.MODAL,
    data: {
        title: "Movie Search",
        custom_id: `search_modal`,
        components: [{
          type: 1,
          components: [{
            type: 4,
            custom_id: `movie_title-${index}`,
            label: "Movie Title",
            style: 1,
            min_length: 1,
            max_length: 100,
            placeholder: random_placeholder,
            required: false
          }]
        }]
    },
    flags: InteractionResponseFlags.EPHEMERAL,
  });
}

//search function for movie list
//returns index into the array of movies
function movie_search(srch_str, srch_idx, dir)
{
  const srch_lower_case = srch_str.toLowerCase().split(/\s+/).filter(t=>!!t);
  let curr_array = [];
  tmdbJson.forEach((e, idx)=>{
    const tmdb_lower_case = e.title.toLowerCase().split(/\s+/).filter(t=>!!t);

    for (let i = 0; i < tmdb_lower_case.length; i++) {
      for (let j = 0; j < srch_lower_case.length; j++) {
        if (tmdb_lower_case[i].startsWith(srch_lower_case[j])) {

          const match = curr_array.find((q)=>{return q.curr_match == idx});
          if (match) {
            match.curr_score++;
          } else {
            curr_array.push({curr_match:idx, curr_score:1});
          }

        }
      }
    }
  });
  curr_array.sort((a,b)=>{return b.curr_score-a.curr_score;});
  // console.log("curr_array: ", curr_array);

  if (srch_idx) {
    const match = curr_array.find((q, idx)=>{return (q.curr_match == srch_idx);});
    let curr_index = curr_array.indexOf(match);
    // console.log("match: ", match);

    if (dir === "next") {
      curr_index = curr_index+1 >= curr_array.length ? 0 : curr_index+1;
    }
    if (dir === "prev") {
      curr_index = curr_index-1 < 0 ? curr_array.length-1 : curr_index-1;
    }
    // console.log("curr_index: ", curr_index);
    return curr_array[curr_index].curr_match;
  }

  if (curr_array.length > 0) {
    return curr_array[0].curr_match;
  }
  return -1;
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
    const movie = tmdbJson?.find(m=>m.id   == el.movieID);
    const list  = listJson?.find(m=>m.dbid == el.movieID);
    // const tally = await vote_tally(movie?.id);

    //generate movie listing with trailer if possible
    let trailers= "";
    if (list?.links.trailer) {
      for (const tr of list.links.trailer) {
        trailers += `Trailer: ${tr}\n`;
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
}

function default_response(input_str)
{
  if (!input_str) {
    input_str = "Sorry that's a wrong number. Please hang up and dial again!" + getRandomEmoji();
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: input_str,
      flags: InteractionResponseFlags.EPHEMERAL,
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
      content: `${movie_name} has ${tally} votes!` + getRandomEmoji(),
      flags: InteractionResponseFlags.EPHEMERAL,
    }
  });
}

async function remove_movie_vote(movieID, userID, title)
{
  const success = await remove_vote(userID, movieID);
  // console.log("removing vote: ", success);

  if (success == false) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "You didn't vote for " + title + " " + getRandomEmoji(),
        flags: InteractionResponseFlags.EPHEMERAL,
      }
    }
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'You have removed your vote for ' + title + " " + getRandomEmoji(), // + <@userID>,
      flags: InteractionResponseFlags.EPHEMERAL,
    }
  }
}

async function vote_for_movie(movieID, userID, movie_name)
{
  if (!movieID) {
    return ({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'What are you doing to me? Pick an actual movie!! 😤',
        flags: InteractionResponseFlags.EPHEMERAL,
      }
    });
  }
  // console.log("movieID: ", movieID);
  const success = await add_vote(userID, movieID);

  if (success == false) {
    return ({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        // Fetches a random emoji to send from a helper function
        content: `You already voted for ${movie_name}, stop wasting my time!` + getRandomEmoji(),// + <@userID>,
        flags: InteractionResponseFlags.EPHEMERAL,
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
      flags: InteractionResponseFlags.EPHEMERAL,
    }
  });
}

async function browse_movies(movieIDX, search_str, res_type, voted)
{
  // console.log("movieIDX: ", movieIDX);
  if (movieIDX === -1) {
    // console.log("no search result found");
    return default_response();
  }

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
  const watchdate = list?.watchdate || "Not Watched";
  // console.log("\n\nwatched: ", watchedate);
  // console.log('\nmovie: ', list);

  const vote_handler = !voted ? {
    type: 2,
    label: `UpVote ${tally>0 ? "("+tally+")" : ""}👍`,
    style: 1,
    custom_id: `vote-${movieIDX}`,
  } : {
    type: 2,
    label: `UnVote ${tally>0 ? "("+tally+")" : ""}👎`,
    style: 4,
    custom_id: `remove_vote-${movieIDX}`,
  };

  return ({
        type: res_type,
        data: {
          // title: "This won't show up anywhere...but I have to double check.",
          custom_id: 'movie_search',
          content: movie_listing,
          components: [
            {
              type: 1,
              components: [
                vote_handler,
                {
                  type: 2,
                  label: 'Website',
                  style: 5,
                  url: `https://quantumapprentice.github.io/Movie-Tracker/movies/${movie_link}`,
                },
                {
                  type: 2,
                  label: `Last Watched: ${watchdate}`,
                  style: 1,
                  custom_id: `watched`,
                },
              ]
            },
            {
              type: 1,        // 1 == action row
              components: [
                {
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
                  label: `Search: ${search_str ? search_str : ""}`,
                  style: 4,
                  custom_id: `search`,
                },
              ]
            },
          ],
          flags: InteractionResponseFlags.EPHEMERAL,
        }
  });
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}
