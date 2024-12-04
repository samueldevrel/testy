import { IDL, query, update } from 'azle';

export default class {
    message: string = 'Hello world!';

    @query([], IDL.Text)
    getMessage(): string {
        return this.message;
    }

    @update([IDL.Text])
    setMessage(message: string): void {
        this.message = message;
    }
}
import {
  Canister,
  Err,
  Ok,
  Principal,
  Record,
  Result,
  StableBTreeMap,
  Variant,
  Vec,
  ic,
  query,
  text,
  Opt,
  update,
} from "azle/experimental";

//define types

const replies = Record({
  by: text,
  postid: Principal,
  replymessage: Opt(text),
  image: Opt(text),
  gif: Opt(text),
});

//defines types
type replies = typeof replies.tsType;

const post = Record({
  id: Principal,
  owner: Principal,
  by: text,
  postimage: Opt(text),
  postmessage: Opt(text),
  replies: Vec(replies),
  likes: Vec(Principal),
  dislikes: Vec(Principal),
});

type post = typeof post.tsType;
const user = Record({
  id: Principal,
  username: text,
  followers: Vec(Principal),
});

type user = typeof user.tsType;

//define varinats

const messagesresponses = Variant({
  alreadyregistered: text,
  alreeadyafollower: text,
  mustbeafollower: text,
  missingcredentials: text,
  postnotaveilable: text,
  mustberegistered: text,
  failedtoaddreply: text,
});

//define payloads

const registeruserpayload = Record({
  username: text,
});
const postpayload = Record({
  by: text,
  postimage: Opt(text),
  postmessage: Opt(text),
});
const getpostpayload = Record({
  postid: Principal,
});

const replypayload = Record({
  by: text,
  postid: Principal,
  replymessage: Opt(text),
  image: Opt(text),
  gif: Opt(text),
});
const getuserpostspayload = Record({
  username: text,
});
const addlikepayload = Record({
  postid: Principal,
});
const deletepostPayload = Record({
  postid: Principal,
});
const usersstorage = StableBTreeMap<text, user>(0);
const postsstorages = StableBTreeMap<Principal, post>(1);

export default Canister({
  //register user
  registeruser: update(
    [registeruserpayload],
    Result(text, messagesresponses),
    (payload) => {
      //verify thats all fields are available
      if (!payload.username) {
        return Err({
          missingcredentials: "username is not avaialble",
        });
      }

      //verify that username is unique
      const userexists = usersstorage.get(payload.username);
      if (userexists) {
        return Err({
          alreadyregistered: "username is already taken",
        });
      }

      //register new user
      const newuser: user = {
        id: ic.caller(),
        username: payload.username,
        followers: [],
      };

      //update the usersstorage canister
      usersstorage.insert(payload.username, newuser);

      return Ok("user registered successfully");
    }
  ),

  //create a post

  createpost: update([postpayload], text, (payload) => {
    //verify username is availble

    if (!payload.by) {
      return "no username is available";
    }

    //verify that users already exists

    const getuser = usersstorage.get(payload.by);
    if (!getuser) {
      return "you are not registered";
    }

    //verify that atleast one credentails is availbel ande also username

    if (payload.postimage || payload.postmessage) {
      //create a new post

      const newpost: post = {
        id: generateId(),
        owner: ic.caller(),
        by: payload.by,
        replies: [],
        likes: [],
        dislikes: [],
        postimage: payload.postimage,
        postmessage: payload.postmessage,
      };

      //add post to canisters stoorage
      postsstorages.insert(ic.caller(), newpost);

      return "post created successfully";
    }

    return "failed to create post";
  }),

  //get all availble posts
  getposts: query([], Vec(post), () => {
    return postsstorages.values();
  }),

  //get a post

  get_a_post: query(
    [getpostpayload],
    Result(post, messagesresponses),
    (payload) => {
      //check if payload is availble
      if (!payload.postid) {
        return Err({
          missingcredentials: "post id is not availble",
        });
      }
      //get the post
      const getpost = postsstorages.get(payload.postid);
      if (getpost) {
        return Ok(getpost);
      }
      return Err({
        postnotaveilable: `post with given id ${payload.postid} is not availble`,
      });
    }
  ),

  //reply to a post

  reply_to_a_post: update(
    [replypayload],
    Result(text, messagesresponses),
    (payload) => {
      //verify all credentials are availble
      if (!payload.by || !payload.postid) {
        return Err({
          missingcredentials: "some credentials are  missing",
        });
      }

      //verify that user is already registered

      const getuser = usersstorage.get(payload.by);
      if (!getuser) {
        return Err({
          mustberegistered: "must be registeerd inorder to reply to a post",
        });
      }

      //verify that post actually exists

      const getpost = postsstorages.get(payload.postid);
      if (!getpost) {
        return Err({
          postnotaveilable: `post with given id ${payload.postid} is not availble`,
        });
      }

      //check availability of alleadt one reply message,or gif or image
      if (payload.gif || payload.image || payload.replymessage) {
        //create a new reply
        const new_reply: replies = {
          by: payload.by,
          postid: payload.postid,
          gif: payload.gif,
          image: payload.image,
          replymessage: payload.replymessage,
        };

        //update post storages canister
        const updatedpost: post = {
          ...getpost,
          replies: [...getpost.replies, new_reply],
        };

        postsstorages.insert(payload.postid, updatedpost);

        return Ok("reply sent");
      }
      return Err({
        failedtoaddreply: "reply not sent",
      });
    }
  ),

  //add like to a post
  add_like_to_a_post: update([addlikepayload], text, (payload) => {
    //verify that postid is available
    if (!payload.postid) {
      return "missing credentials";
    }

    //check if the post is available
    const getpost = postsstorages.get(payload.postid);
    if (!getpost) {
      return `post with given id ${payload.postid} is not available`;
    }

    //add like to the post

    const updatepost: post = {
      ...getpost,
      likes: [...getpost.likes, ic.caller()],
    };

    //update post storages canister
    postsstorages.insert(payload.postid, updatepost);
    return "liked the post";
  }),

  //delete post

  delete_post: update([deletepostPayload], text, (payload) => {
    //verify tahat payload is not empty
    if (!payload.postid) {
      return "post id is not available";
    }

    //verify that post actuallly exists

    const getpost = postsstorages.get(payload.postid);

    if (!getpost) {
      return "post is not avilable";
    }

    //verify its the owner who is actually performing the action

    if (getpost.owner.toText() == ic.caller().toText()) {
      postsstorages.remove(payload.postid);
      return "deleted post ";
    }
    return "failed to delete the post";
  }),
});

function generateId(): Principal {
  const randomBytes = new Array(29)
    .fill(0)
    .map((_) => Math.floor(Math.random() * 256));
  return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}
