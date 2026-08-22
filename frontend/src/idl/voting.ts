/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/voting.json`.
 */
export type Voting = {
  "address": "2QaArRLt7zTe3orXxpv1Epx9v5a4Ga9KbCp5655QbCtg",
  "metadata": {
    "name": "voting",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "activatePoll",
      "docs": [
        "Move the poll from Draft to Active and open voting for",
        "`duration_seconds`."
      ],
      "discriminator": [
        93,
        248,
        5,
        3,
        106,
        145,
        72,
        39
      ],
      "accounts": [
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "poll"
          ]
        },
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "poll.creator",
                "account": "poll"
              },
              {
                "kind": "account",
                "path": "poll.poll_id",
                "account": "poll"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "durationSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "addCandidate",
      "docs": [
        "Add a voting option. Only allowed while the poll is in Draft."
      ],
      "discriminator": [
        172,
        34,
        30,
        247,
        165,
        210,
        224,
        164
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "poll"
          ]
        },
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "poll.creator",
                "account": "poll"
              },
              {
                "kind": "account",
                "path": "poll.poll_id",
                "account": "poll"
              }
            ]
          }
        },
        {
          "name": "candidate",
          "docs": [
            "The next candidate slot: seeded by the poll's current candidate",
            "count, so candidates always get consecutive indexes 0, 1, 2, ..."
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        }
      ]
    },
    {
      "name": "closePoll",
      "docs": [
        "Move the poll from Active to Closed. The creator can close at any",
        "time; anyone else only after `end_time` has passed."
      ],
      "discriminator": [
        139,
        213,
        162,
        65,
        172,
        150,
        123,
        67
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "poll.creator",
                "account": "poll"
              },
              {
                "kind": "account",
                "path": "poll.poll_id",
                "account": "poll"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "createPoll",
      "docs": [
        "Create a poll in Draft status together with its Token-2022 ballot",
        "mint, whose on-chain TokenMetadata extension stores the poll title."
      ],
      "discriminator": [
        182,
        171,
        112,
        238,
        6,
        219,
        14,
        110
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "pollId"
              }
            ]
          }
        },
        {
          "name": "ballotMint",
          "docs": [
            "Token-2022 ballot mint. The MetadataPointer extension points at the",
            "mint account itself, so the poll title is stored on the mint."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "poll"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pollId",
          "type": "u64"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        }
      ]
    },
    {
      "name": "vote",
      "docs": [
        "Cast a vote for a candidate. Mints one ballot token to the voter and",
        "records a VoteReceipt PDA so the same wallet cannot vote twice."
      ],
      "discriminator": [
        227,
        110,
        155,
        23,
        136,
        126,
        172,
        25
      ],
      "accounts": [
        {
          "name": "voter",
          "writable": true,
          "signer": true
        },
        {
          "name": "poll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "poll.creator",
                "account": "poll"
              },
              {
                "kind": "account",
                "path": "poll.poll_id",
                "account": "poll"
              }
            ]
          },
          "relations": [
            "candidate"
          ]
        },
        {
          "name": "candidate",
          "writable": true
        },
        {
          "name": "receipt",
          "docs": [
            "Created fresh for every (poll, voter) pair — a second vote from the",
            "same wallet fails because this PDA already exists."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "poll"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "ballotMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "poll"
              }
            ]
          }
        },
        {
          "name": "voterBallotAccount",
          "docs": [
            "The voter's Token-2022 associated token account; receives one ballot",
            "token as an on-chain proof of participation."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "voter"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "ballotMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "candidateIndex",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "candidate",
      "discriminator": [
        86,
        69,
        250,
        96,
        193,
        10,
        222,
        123
      ]
    },
    {
      "name": "poll",
      "discriminator": [
        110,
        234,
        167,
        188,
        231,
        136,
        153,
        111
      ]
    },
    {
      "name": "voteReceipt",
      "discriminator": [
        104,
        20,
        204,
        252,
        45,
        84,
        37,
        195
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "pollNotDraft",
      "msg": "Poll is not in draft status"
    },
    {
      "code": 6001,
      "name": "pollNotActive",
      "msg": "Poll is not active"
    },
    {
      "code": 6002,
      "name": "pollEnded",
      "msg": "Poll voting period has ended"
    },
    {
      "code": 6003,
      "name": "pollNotEnded",
      "msg": "Poll voting period has not ended yet"
    },
    {
      "code": 6004,
      "name": "unauthorized",
      "msg": "Only the poll creator may perform this action"
    },
    {
      "code": 6005,
      "name": "notEnoughCandidates",
      "msg": "A poll needs at least two candidates before it can be activated"
    },
    {
      "code": 6006,
      "name": "tooManyCandidates",
      "msg": "Maximum number of candidates reached"
    },
    {
      "code": 6007,
      "name": "stringTooLong",
      "msg": "Provided string exceeds the maximum allowed length"
    },
    {
      "code": 6008,
      "name": "invalidCandidate",
      "msg": "Candidate does not belong to this poll"
    },
    {
      "code": 6009,
      "name": "invalidDuration",
      "msg": "Poll duration must be positive"
    }
  ],
  "types": [
    {
      "name": "candidate",
      "docs": [
        "One voting option. PDA: [\"candidate\", poll, index]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poll",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "votes",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "poll",
      "docs": [
        "One poll. PDA: [\"poll\", creator, poll_id]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "pollId",
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "pollStatus"
              }
            }
          },
          {
            "name": "candidateCount",
            "type": "u8"
          },
          {
            "name": "totalVotes",
            "type": "u64"
          },
          {
            "name": "startTime",
            "docs": [
              "Unix timestamp when the poll was activated (0 while Draft)."
            ],
            "type": "i64"
          },
          {
            "name": "endTime",
            "docs": [
              "Unix timestamp after which voting is no longer allowed (0 while Draft)."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "mintBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "pollStatus",
      "docs": [
        "Lifecycle of a poll: Draft -> Active -> Closed."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "draft"
          },
          {
            "name": "active"
          },
          {
            "name": "closed"
          }
        ]
      }
    },
    {
      "name": "voteReceipt",
      "docs": [
        "Proof that a wallet voted on a poll; its existence prevents double voting.",
        "PDA: [\"vote\", poll, voter]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poll",
            "type": "pubkey"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "candidateIndex",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "ballotTokenSeed",
      "type": "bytes",
      "value": "[98, 97, 108, 108, 111, 116]"
    },
    {
      "name": "candidateSeed",
      "type": "bytes",
      "value": "[99, 97, 110, 100, 105, 100, 97, 116, 101]"
    },
    {
      "name": "mintSeed",
      "type": "bytes",
      "value": "[109, 105, 110, 116]"
    },
    {
      "name": "pollSeed",
      "type": "bytes",
      "value": "[112, 111, 108, 108]"
    },
    {
      "name": "voteSeed",
      "type": "bytes",
      "value": "[118, 111, 116, 101]"
    }
  ]
};
