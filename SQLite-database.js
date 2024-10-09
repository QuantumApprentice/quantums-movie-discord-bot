// import sqlite3 from "sqlite3";
// const { default: sqlite3 } = await import("sqlite3");
// const sqlite3 = require("sqlite3");
let sqlite3 = require("sqlite3");
// sqlite3 = sqlite3.default;
// let sqlite3;
// await import("sqlite3").then(m => {sqlite3 = m});
export const sqlite_db = new sqlite3.Database(
  "../sqlite_db/movie-tracker.db",
  sqlite3.OPEN_READWRITE,
  (err)=>{if (err) {console.log("SQLite-db error: ",  err);}}
);

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

export async function db_all(query, params, callback)
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
export async function db_run(query, params, callback)
{

  return sqlite_db.run(
    query, params, callback
  );

  // return new Promise(
  //   (resolve, reject) => sqlite_db.run(
  //     query, params,
  //     (err, row) => {
  //       if (err) return reject(err);
  //       resolve(row);
  //     }
  //   )
  // )
}

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
  // const q = "INSERT INTO movie_vote (voterID, movieID) \
  //         SELECT ?, ? \
  //         WHERE NOT EXISTS ( \
  //         SELECT 1 FROM movie_vote \
  //         WHERE voterID = ? \
  //         AND movieID = ? \
  //         );"

  console.log("voterID: ", voterID);
  console.log("movieID: ", movieID);

  let result;
  try {
    result = await db_all(q, [voterID, movieID], function (e){
      console.log("e: ", e);
      console.log("this: ", this);
      if (e.errno === 19) {
        console.log("returning false, e: ", e);
        return false;
      }
    });
    console.log("add_vote result: ", result);
  } catch (error) {
    // if (error.errno === 19) {
    //   console.log("do something here\n");
    //   return false;
    // }
    console.log("result: ", result);
    console.log("Error while voting: ", error);
  }

  return true;
}

export async function remove_vote(dbid, voterID) {
  const q = 'DELETE FROM movie_vote \
            WHERE "movieID"=? AND "voterID"=?;'// LIMIT 1;'
  console.log("dbid: ", dbid);
  console.log("voterID: ", voterID);

  let result;
  try {
    result = await db_run(q, [dbid, voterID], function a(e, r){
      console.log("e: ", e);
      console.log("r: ", r);
    });
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
    // console.log("count result: ", result);
  } catch (error) {
    console.log("Error getting tally: ", error);
  }
  return result[0].count;
}

