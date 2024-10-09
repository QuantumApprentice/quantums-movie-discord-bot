import sqlite3 from "sqlite3";
// const { default: sqlite3 } = await import("sqlite3");
// const sqlite3 = require("sqlite3");
// let sqlite3 = require("sqlite3");
// sqlite3 = sqlite3.default;
// let sqlite3;
// await import("sqlite3").then(m => {sqlite3 = m});
const sqlite_db = new sqlite3.Database(
  "../sqlite_db/movie-tracker.db",
  sqlite3.OPEN_READWRITE,
  (err)=>{if (err) {console.log("SQLite-db error: ",  err);}}
);

// const tmp = await new Promise(
//   (resolve, reject) => sqlite_db.all(
//     "SELECT * FROM movie_vote;",
//     (err, row) => {
//       if (err) return reject(err);
//       resolve(row);
//     }
//   )
// );
// console.log("tmp: ", tmp);
// sqlite_db.get("SELECT * FROM movie_vote;",
//   (e, row)=>{
//     if (e) {
//       console.log("get error: ", e);
//     }
//     if (row) {
//       console.log("row: ", row);
//     }
//   }
// );

// This approach of letting you pass in the client means 
// this "library" code can handle any of the main 4 situations: 
// 1) pool only for single-query requests, 
// 2) direct client connection, 
// 3) client connection "connected" from the pool, 
// 4) queries as part of a transaction

//pool is allocated outside this file, client function? is passed in
// function add_vote(user_id, movie_id, client=null) {
//   if (!client) client = pool;
//   /* ...*/ ;
//   let result = await client.query(sql);
//   /* ... */ 
// }

async function db_all(query, params)
{
  return new Promise(
    (resolve, reject) => sqlite_db.all(
      query, params,
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    )
  );
}
async function db_run(query, params)
{
  return new Promise(
    (resolve, reject) => sqlite_db.run(
      query, params,
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    )
  )
}


// //////////////////////////////////////////////////////////////////////////////////
// //FOSSUnleashed example
// // Promise version
// export function get_top_five() {
// 	return new Promise((pass, fail) => {
// 		const q = 'SELECT movieID, COUNT(*) as tally FROM ? GROUP BY movieID'
// 		sqlite_db.all(q, [], (e, r) => {
// 			// could do some processing here, would need to on the vote() function
// 			if (e) return fail(e)
// 			pass(r)
// 		})
// 	})
// }
// // Callback version; NOTE: the results are given to the callback instead of returned
// export function get_top_five(cb) {
// 	const q = 'SELECT movieID, COUNT(*) as tally FROM ? GROUP BY movieID'
// 	sqlite_db.all(q, [], (e, r) => {
// 		// Could do some processing here, would need to on the vote() function
// 		cb(e, r)
// 	})
// }
// //////////////////////////////////////////////////////////////////////////////////


export async function get_top_five()
{
  const q = 'SELECT "movieID", COUNT(*) as tally FROM movie_vote \
            GROUP BY "movieID";';
  let result;
  try {
    result = await db_all(q);
    // console.log("top 5 result: ", result);
    return result;
  } catch (error) {
    console.log("Error getting top 5: ", error);
  }
}

export async function add_vote(voterID, movieID)
{
  const q = 'INSERT INTO movie_vote (voterID, movieID) \
                VALUES (?, ?);';

  const r = sqlite_db.prepare("INSERT OR IGNORE INTO movie_vote (voterID, movieID) VALUES (?, ?);");
  // console.log("voterID: ", voterID);
  // console.log("movieID: ", movieID);
  try {
    return new Promise(
      (res,rej)=>{
        r.run(
          [voterID, movieID], function(err){
            if (err) return rej(err);
            res(!!this.changes);
          }
        )
      }
    );
    // await db_run(q, [voterID, movieID], function (e, r){
    //   console.log("e: ", e);
    //   console.log("this: ", this);
    //   if (e.errno === 19) {
    //     console.log("returning false, e: ", e);
    //     return false;
    //   }
    // });
  } catch (error) {
    console.log("Error while voting: ", error);
  }
}

export async function remove_vote(movieID, voterID) {
  const q = 'DELETE FROM movie_vote \
            WHERE "voterID"=? AND "movieID"=?;'// LIMIT 1;'
  // console.log("voterID: ", voterID);
  // console.log("movieID: ", movieID);

  let result;
  try {
    return new Promise(
      (res,rej)=>{
        sqlite_db.run(
          q, [voterID, movieID], function(err){
            if (err) return rej(err);
            return res(!!this.changes);
          }
        )
      }
    )
  } catch (error) {
    console.log("Error removing vote: ", error);
  }
  return result;
}

export async function vote_tally(dbid) {
  const q = 'SELECT COUNT(*) as tally FROM movie_vote \
            WHERE "movieID"=?;'
  let result;
  try {
    result = await db_all(q, [dbid]);
  } catch (error) {
    console.log("Error getting tally: ", error);
  }
  // console.log("tally result: ", result);
  return result[0].tally;
}

