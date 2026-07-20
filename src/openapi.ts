const userSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email" },
    fullName: { type: "string", nullable: true },
    phone: { type: "string", nullable: true },
  },
};

const errorResponse = {
  type: "object",
  properties: {
    success: { type: "boolean", example: false },
    error: { type: "string" },
  },
};

const contactSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    relation: { type: "string", nullable: true },
    email: { type: "string", format: "email", example: "mom@example.com" },
    phone: { type: "string", nullable: true, example: "+919000000001" },
  },
};

const sosEventSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    userId: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["active", "resolved", "cancelled"] },
    trackToken: { type: "string" },
    initialLat: { type: "number", nullable: true },
    initialLng: { type: "number", nullable: true },
    mediaUrl: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    resolvedAt: { type: "string", format: "date-time", nullable: true },
  },
};

const locationUpdateSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    sosEventId: { type: "string", format: "uuid" },
    lat: { type: "number" },
    lng: { type: "number" },
    accuracy: { type: "number", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

// Reusable response wrappers for the { success, data } envelope.
const ok = (dataSchema: object) => ({
  type: "object",
  properties: { success: { type: "boolean", example: true }, data: dataSchema },
});
const errRef = { $ref: "#/components/schemas/Error" };
const jsonError = (description: string) => ({
  description,
  content: { "application/json": { schema: errRef } },
});
const jsonOk = (description: string, dataSchema: object) => ({
  description,
  content: { "application/json": { schema: ok(dataSchema) } },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Her Ashtra API",
    version: "1.0.0",
    description: "Auth backend for Her Ashtra — register, login, and manage the current user.",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: userSchema,
      Error: errorResponse,
      Contact: contactSchema,
      SosEvent: sosEventSchema,
      LocationUpdate: locationUpdateSchema,
    },
  },
  tags: [
    { name: "Auth" },
    { name: "Health" },
    { name: "Contacts", description: "Trusted-circle contacts notified on an SOS" },
    { name: "SOS", description: "Panic-alert lifecycle" },
    { name: "Track", description: "Public token-scoped live location (no auth)" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness check",
        responses: {
          200: { description: "Service is up" },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create an account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  fullName: { type: "string" },
                  phone: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Account created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        token: { type: "string" },
                        user: { $ref: "#/components/schemas/User" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          409: { description: "Email already registered", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Logged in",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        token: { type: "string" },
                        user: { $ref: "#/components/schemas/User" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Invalid email or password", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the current user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          401: { description: "Missing or invalid token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      put: {
        tags: ["Auth"],
        summary: "Update the current user",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  fullName: { type: "string" },
                  phone: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          400: { description: "No fields to update / validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          401: { description: "Missing or invalid token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ---- Contacts ------------------------------------------------------
    "/api/contacts": {
      get: {
        tags: ["Contacts"],
        summary: "List your trusted-circle contacts",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonOk("Your contacts", { type: "array", items: { $ref: "#/components/schemas/Contact" } }),
          401: jsonError("Missing or invalid token"),
        },
      },
      post: {
        tags: ["Contacts"],
        summary: "Add a contact",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email"],
                properties: {
                  name: { type: "string" },
                  relation: { type: "string" },
                  email: { type: "string", format: "email", example: "mom@example.com" },
                  phone: { type: "string", description: "Optional, E.164 format", example: "+919000000001" },
                },
              },
            },
          },
        },
        responses: {
          201: jsonOk("Contact created", { $ref: "#/components/schemas/Contact" }),
          400: jsonError("Validation error (e.g. phone not E.164)"),
          401: jsonError("Missing or invalid token"),
        },
      },
    },
    "/api/contacts/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      put: {
        tags: ["Contacts"],
        summary: "Update a contact",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  relation: { type: "string" },
                  email: { type: "string", format: "email", example: "mom@example.com" },
                  phone: { type: "string", example: "+919000000001" },
                },
              },
            },
          },
        },
        responses: {
          200: jsonOk("Contact updated", { $ref: "#/components/schemas/Contact" }),
          400: jsonError("Validation error / no fields to update"),
          401: jsonError("Missing or invalid token"),
          404: jsonError("Contact not found"),
        },
      },
      delete: {
        tags: ["Contacts"],
        summary: "Remove a contact",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonOk("Contact removed", { type: "object", properties: { id: { type: "string", format: "uuid" } } }),
          401: jsonError("Missing or invalid token"),
          404: jsonError("Contact not found"),
        },
      },
    },

    // ---- SOS -----------------------------------------------------------
    "/api/sos": {
      get: {
        tags: ["SOS"],
        summary: "Your SOS history (newest first)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonOk("SOS events", { type: "array", items: { $ref: "#/components/schemas/SosEvent" } }),
          401: jsonError("Missing or invalid token"),
        },
      },
      post: {
        tags: ["SOS"],
        summary: "Trigger an SOS (notifies contacts by SMS)",
        description:
          "Creates the event, responds immediately, then fires SMS to your contacts in the background.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  initialLat: { type: "number", example: 28.6139 },
                  initialLng: { type: "number", example: 77.209 },
                  mediaUrl: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          201: jsonOk("SOS created", {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              trackToken: { type: "string" },
              trackUrl: { type: "string", format: "uri" },
              status: { type: "string", example: "active" },
              createdAt: { type: "string", format: "date-time" },
            },
          }),
          400: jsonError("Validation error"),
          401: jsonError("Missing or invalid token"),
        },
      },
    },
    "/api/sos/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get: {
        tags: ["SOS"],
        summary: "One SOS event plus its location trail",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonOk("SOS event with locations", {
            allOf: [
              { $ref: "#/components/schemas/SosEvent" },
              {
                type: "object",
                properties: { locations: { type: "array", items: { $ref: "#/components/schemas/LocationUpdate" } } },
              },
            ],
          }),
          401: jsonError("Missing or invalid token"),
          404: jsonError("SOS event not found"),
        },
      },
      patch: {
        tags: ["SOS"],
        summary: "Attach media URL to an active SOS",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["mediaUrl"],
                properties: { mediaUrl: { type: "string", format: "uri" } },
              },
            },
          },
        },
        responses: {
          200: jsonOk("Updated SOS event", { $ref: "#/components/schemas/SosEvent" }),
          400: jsonError("Validation error"),
          401: jsonError("Missing or invalid token"),
          404: jsonError("SOS event not found"),
        },
      },
    },
    "/api/sos/{id}/locations": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      post: {
        tags: ["SOS"],
        summary: "Append a live location point (active events only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["lat", "lng"],
                properties: {
                  lat: { type: "number", example: 28.6145 },
                  lng: { type: "number", example: 77.21 },
                  accuracy: { type: "number", example: 12.5 },
                },
              },
            },
          },
        },
        responses: {
          201: jsonOk("Location recorded", { $ref: "#/components/schemas/LocationUpdate" }),
          400: jsonError("Validation error"),
          401: jsonError("Missing or invalid token"),
          404: jsonError("SOS event not found"),
          409: jsonError("SOS event is not active"),
        },
      },
    },
    "/api/sos/{id}/resolve": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      post: {
        tags: ["SOS"],
        summary: "Mark yourself safe (resolve the SOS)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonOk("SOS resolved", { $ref: "#/components/schemas/SosEvent" }),
          401: jsonError("Missing or invalid token"),
          404: jsonError("SOS event not found"),
        },
      },
    },

    // ---- Track (public) ------------------------------------------------
    "/api/track/{token}": {
      get: {
        tags: ["Track"],
        summary: "Public live location for a tracking token (no auth)",
        description:
          "Consumed by the /track/{token} page. Live coordinates are withheld once the event is resolved.",
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: jsonOk("Tracking snapshot", {
            type: "object",
            properties: {
              status: { type: "string", enum: ["active", "resolved", "cancelled"] },
              userName: { type: "string", description: "First name only" },
              initialLocation: {
                type: "object",
                nullable: true,
                properties: { lat: { type: "number" }, lng: { type: "number" } },
              },
              latest: {
                type: "object",
                nullable: true,
                properties: {
                  lat: { type: "number" },
                  lng: { type: "number" },
                  accuracy: { type: "number", nullable: true },
                  at: { type: "string", format: "date-time" },
                },
              },
              createdAt: { type: "string", format: "date-time" },
              resolvedAt: { type: "string", format: "date-time", nullable: true },
            },
          }),
          404: jsonError("Unknown tracking link"),
        },
      },
    },
  },
};
