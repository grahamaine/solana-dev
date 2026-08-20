/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/counter.json`.
 */
export type Counter = {
  "address": "68pjM74E2ow8dRxKPCh1cjcaHYEpAtjJRPJmxstQNCVp",
  "metadata": {
    "name": "counter",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Week 2 exercise — counter that saves data in a PDA"
  },
  "instructions": [
    {
      "name": "decrement",
      "docs": [
        "Subtract one from the stored count; fails at zero instead of",
        "wrapping around."
      ],
      "discriminator": [
        106,
        227,
        168,
        59,
        248,
        27,
        150,
        101
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "counter"
          ]
        },
        {
          "name": "counter",
          "docs": [
            "Re-deriving the PDA from the stored authority proves this is the",
            "signer's own counter; has_one rejects anyone else's signature."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "counter.authority",
                "account": "counter"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "increment",
      "docs": [
        "Add one to the stored count."
      ],
      "discriminator": [
        11,
        18,
        104,
        9,
        104,
        174,
        59,
        33
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "counter"
          ]
        },
        {
          "name": "counter",
          "docs": [
            "Re-deriving the PDA from the stored authority proves this is the",
            "signer's own counter; has_one rejects anyone else's signature."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "counter.authority",
                "account": "counter"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "docs": [
        "Create the counter PDA for the signing wallet, starting at 0."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "counter",
          "docs": [
            "The counter data account. `init` allocates it via the System",
            "Program, funds it rent-exempt, and assigns ownership to this",
            "program — that is how Solana \"saves\" data."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "reset",
      "docs": [
        "Set the count back to 0."
      ],
      "discriminator": [
        23,
        81,
        251,
        84,
        138,
        183,
        240,
        214
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "counter"
          ]
        },
        {
          "name": "counter",
          "docs": [
            "Re-deriving the PDA from the stored authority proves this is the",
            "signer's own counter; has_one rejects anyone else's signature."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "counter.authority",
                "account": "counter"
              }
            ]
          }
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "counter",
      "discriminator": [
        255,
        176,
        4,
        245,
        188,
        253,
        124,
        25
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "underflow",
      "msg": "Counter cannot go below zero"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Only the counter's owner may modify it"
    }
  ],
  "types": [
    {
      "name": "counter",
      "docs": [
        "Layout on-chain: 8-byte discriminator + 32 (authority) + 8 (count)",
        "+ 1 (bump) = 49 bytes."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "The wallet this counter belongs to (also part of the PDA seeds)."
            ],
            "type": "pubkey"
          },
          {
            "name": "count",
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "Cached bump so instructions don't have to search for it again."
            ],
            "type": "u8"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "counterSeed",
      "type": "bytes",
      "value": "[99, 111, 117, 110, 116, 101, 114]"
    }
  ]
};
