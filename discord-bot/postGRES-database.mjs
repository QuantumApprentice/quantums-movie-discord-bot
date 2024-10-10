import pg from 'npm:pg';
const { Pool, Client } = pg;

// process.version.includes("node");
// if (Deno);

const connectionString = Deno?.env.get('SUPABASE_DB_URL');
// const secretPass  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const pool = new Pool({connectionString});

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
  const q = 'SELECT "movieID", COUNT(*) FROM movie_vote \
            GROUP BY "movieID";';
  let result;
  try {
    result = await client.query(q);
  } catch (error) {
    console.log("Error getting top 5: ", error);
  }
  return result.rows;
}

export async function add_vote(voter, movieid, client=pool)
{
  const q = 'INSERT INTO movie_vote (voter, movieid) \
                VALUES ($1, $2);';

  let result;
  try {
    result = await client.query(q, [voter, movieid]);
  } catch (error) {
    console.log("Error while voting: ", error);
  }

  // if (client !== pool) {
  //   client.release();
  // }

  if (result === undefined) {
    return false;
  } else {
    return true;
  }
}

export async function remove_vote(dbid, userID) {
  const q = 'DELETE FROM movie_vote WHERE "movieID"=$1 AND "voter"=$2;'// LIMIT 1;'
  let result;
  try {
    result = await pool.query(q, [dbid, userID]);
  } catch (error) {
    console.log("Error removing vote: ", error);
  }
  return result;
}

export async function vote_tally(dbid) {
  const q = 'SELECT COUNT(*) FROM movie_vote WHERE "movieID"=$1;'
  let result;
  try {
    result = await pool.query(q, [dbid]);
  } catch (error) {
    console.log("Error getting tally: ", error);
  }
  return result.rows[0].count;
}
