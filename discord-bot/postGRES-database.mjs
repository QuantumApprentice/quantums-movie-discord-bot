//Deno version
// import pg from 'npm:pg';
//Node version
import pg from "pg";
const { Pool, Client } = pg;

// process.version.includes("node");
// if (Deno);
// const connectionString = Deno?.env.get('SUPABASE_DB_URL');
// const secretPass  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// const pool = new Pool({connectionString});


// var conString = "postgres://YourUserName:YourPassword@localhost:5432/YourDatabase";
// var client = new pg.Client(conString);
// client.connect();


const pool = new Pool({
  user: 'quantum',
  password: process.env.POSTGRES_PASS,
  host: 'localhost',
  port: '5432',
  database: 'postgres',
});

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

export async function get_top_five(client=pool)
{
  const q = 'SELECT movieid AS "movieID", COUNT(*) AS tally FROM movie_vote \
            GROUP BY movieid;';
  try {
    const result = await client.query(q);
    // console.log("result: ", result);
    return result.rows;
  } catch (error) {
    console.log("Error getting top 5: ", error);
  }
}

export async function add_vote(userID, dbid, client=pool)
{
  const q = "INSERT \
             INTO movie_vote (voterid, movieid) \
             VALUES ($1, $2) \
             ON CONFLICT ON CONSTRAINT movie_vote_pkey DO NOTHING;";

  try {
    const result = await client.query(q, [userID, dbid]);
    // console.log("add_vote result: ", result);
    return (!!result.rowCount);
  } catch (error) {
    console.log("Error while voting: ", error);
  }

}

export async function remove_vote(userID, dbid) {
  const q = "DELETE FROM movie_vote WHERE voterid=$1 AND movieid=$2;"// LIMIT 1;'
  try {
    const result = await pool.query(q, [userID, dbid]);
    // console.log("add_vote result: ", result);
    return (!!result.rowCount);
  } catch (error) {
    console.log("Error removing vote: ", error);
  }
}

export async function vote_tally(dbid) {
  const q = 'SELECT COUNT(*) FROM movie_vote WHERE movieid=$1;'
  try {
    const result = await pool.query(q, [dbid]);
    return result.rows[0].count;
  } catch (error) {
    console.log("Error getting tally: ", error);
  }
}

export async function user_voted(userID, dbid) {
  const q = 'SELECT 1 FROM movie_vote WHERE voterid=$1 AND movieid=$2;'
  try {
    const result = await pool.query(q, [userID, dbid]);
    // console.log("result: ", result.rowCount);
    return result.rowCount == 1;
  } catch (error) {
    console.log("Error checking if user voted for movie: ", error);
  }
}
