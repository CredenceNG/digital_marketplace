import * as crud from 'back-end/lib/crud';
import { approveAffiliation, Connection, createAffiliation, deleteAffiliation, readActiveOwnerCount, readManyAffiliations, readOneAffiliation, readOneUserByEmail } from 'back-end/lib/db';
import * as permissions from 'back-end/lib/permissions';
import { Request, Response } from 'back-end/lib/server';
import { basicResponse, JsonResponseBody, makeJsonResponseBody, nullRequestBodyHandler } from 'back-end/lib/server';
import { SupportedRequestBodies, SupportedResponseBodies } from 'back-end/lib/types';
import { validateAffiliationId, validateOrganizationId } from 'back-end/lib/validation';
import { getString } from 'shared/lib';
import { Affiliation, AffiliationSlim, CreateRequestBody, CreateValidationErrors, DeleteValidationErrors, MembershipStatus, MembershipType, UpdateValidationErrors } from 'shared/lib/resources/affiliation';
import { Session } from 'shared/lib/resources/session';
import { User, UserStatus, UserType } from 'shared/lib/resources/user';
import { Id } from 'shared/lib/types';
import { allValid, getInvalidValue, invalid, isInvalid, valid } from 'shared/lib/validation';
import * as affiliationValidation from 'shared/lib/validation/affiliation';

export interface ValidatedCreateRequestBody {
  user: Id;
  organization: Id;
  membershipType: MembershipType;
  membershipStatus: MembershipStatus;
}

type ValidatedUpdateRequestBody = Id;

type ValidatedDeleteRequestBody = Id;

type Resource = crud.Resource<
  SupportedRequestBodies,
  SupportedResponseBodies,
  CreateRequestBody,
  ValidatedCreateRequestBody,
  CreateValidationErrors,
  null,
  null,
  null,
  ValidatedUpdateRequestBody,
  UpdateValidationErrors,
  ValidatedDeleteRequestBody,
  DeleteValidationErrors,
  Session,
  Connection
>;

const resource: Resource = {
  routeNamespace: 'affiliations',

  readMany(connection) {
    return nullRequestBodyHandler<JsonResponseBody<AffiliationSlim[] | string[]>, Session>(async request => {
      const respond = (code: number, body: AffiliationSlim[] | string[]) => basicResponse(code, request.session, makeJsonResponseBody(body));
      if (!request.session.user || !permissions.readManyAffiliations(request.session)) {
        return respond(401, [permissions.ERROR_MESSAGE]);
      }
      const dbResult = await readManyAffiliations(connection, request.session.user.id);
      if (isInvalid(dbResult)) {
        return respond(503, ['Database error']);
      }
      return respond(200, dbResult.value);
    });
  },

  create(connection) {
    return {
      async parseRequestBody(request) {
        const body: unknown = request.body.tag === 'json' ? request.body.value : {};
        return {
          userEmail: getString(body, 'userEmail'),
          organization: getString(body, 'organization'),
          membershipType: getString(body, 'membershipType')
        };
      },
      async validateRequestBody(request) {
        const { userEmail, organization, membershipType } = request.body;
        // Attempt to fetch a valid user for the given email
        const validatedUser = await readOneUserByEmail(connection, userEmail);
        const validatedOrganization = await validateOrganizationId(connection, organization);
        const validatedMembershipType = affiliationValidation.validateMembershipType(membershipType);
        if (allValid([validatedUser, validatedOrganization, validatedMembershipType])) {
          const user = validatedUser.value as User | null;
          if (!user) {
            return invalid({
              inviteeNotRegistered: ['User is not registered, but has been notified.']
            });
          }
          // Only active members can be invited
          if (user.status !== UserStatus.Active) {
            return invalid({
              affiliation: ['Only active members can be invited.']
            });
          }
          // Only vendor type users can be invited
          if (user.type !== UserType.Vendor) {
            return invalid({
              affiliation: ['Only vendors can be invited.']
            });
          }
          if (!await permissions.createAffiliation(connection, request.session, organization)) {
            return invalid({
              permissions: [permissions.ERROR_MESSAGE]
            });
          }
          // Do not create if there is already an active affiliation for this user/org
          const dbResult = await readOneAffiliation(connection, user.id, organization);
          if (isInvalid(dbResult)) {
            return invalid({ database: ['Database error']});
          }
          if (dbResult.value) {
            return invalid({ affiliation: ['This user is already a member of this organization.']});
          }
          return valid({
            user: user.id,
            organization,
            membershipType: (validatedMembershipType.value as MembershipType),
            membershipStatus: MembershipStatus.Pending
          });
        } else {
          return invalid({
            user: getInvalidValue(validatedUser, undefined),
            organization: getInvalidValue(validatedOrganization, undefined),
            membershipType: getInvalidValue(validatedMembershipType, undefined)
          });
        }
      },
      respond: crud.wrapRespond({
        valid: (async request => {
          const dbResult = await createAffiliation(connection, request.body);
          if (isInvalid(dbResult)) {
            return basicResponse(503, request.session, makeJsonResponseBody({ database: ['Database error'] }));
          }
          return basicResponse(201, request.session, makeJsonResponseBody(dbResult.value));
        }) as (request: Request<ValidatedCreateRequestBody, Session>) => Promise<Response<JsonResponseBody<Affiliation | CreateValidationErrors>, Session>>,
        invalid: (async request => {
          if (request.body.affiliation) {
            return basicResponse(409, request.session, makeJsonResponseBody(request.body));
          }
          if (request.body.inviteeNotRegistered) {
            // TODO: send invitee notification requesting registration once email notifications in place
            return basicResponse(200, request.session, makeJsonResponseBody(request.body));
          }
          return basicResponse(400, request.session, makeJsonResponseBody(request.body));
        }) as (request: Request<CreateValidationErrors, Session>) => Promise<Response<JsonResponseBody<CreateValidationErrors>, Session>>
      })
    };
  },

  update(connection) {
    return {
      async parseRequestBody(request) {
        return null;
      },
      async validateRequestBody(request) {
        const validatedAffiliation = await validateAffiliationId(connection, request.params.id);
        if (isInvalid(validatedAffiliation)) {
          return invalid({
            affiliation: getInvalidValue(validatedAffiliation, undefined)
          });
        }
        const existingAffiliation = validatedAffiliation.value;
        if (existingAffiliation.membershipStatus === MembershipStatus.Pending) {
          if (!permissions.updateAffiliation(request.session, existingAffiliation)) {
            return invalid({
              permissions: [permissions.ERROR_MESSAGE]
            });
          }
          return valid(existingAffiliation.id);
        }
        return invalid({
          affiliation: ['Membership is not pending.']
        });
      },
      respond: crud.wrapRespond({
        valid: (async request => {
          const id = request.body;
          const dbResult = await approveAffiliation(connection, id);
          if (isInvalid(dbResult)) {
            return basicResponse(503, request.session, makeJsonResponseBody({ database: ['Database error']}));
          }
          return basicResponse(200, request.session, makeJsonResponseBody(dbResult.value));
        }) as (request: Request<ValidatedUpdateRequestBody, Session>) => Promise<Response<JsonResponseBody<Affiliation | UpdateValidationErrors>, Session>>,
        invalid: (async request => {
          return basicResponse(400, request.session, makeJsonResponseBody(request.body));
        }) as (request: Request<UpdateValidationErrors, Session>) => Promise<Response<JsonResponseBody<UpdateValidationErrors>, Session>>
      })
    };
  },

  delete(connection) {
    return {
      async validateRequestBody(request) {
        const validatedAffiliation = await validateAffiliationId(connection, request.params.id);
        if (isInvalid(validatedAffiliation)) {
          return invalid({
            affiliation: getInvalidValue(validatedAffiliation, undefined)
          });
        }

        const existingAffiliation = validatedAffiliation.value;
        if (existingAffiliation.membershipType === MembershipType.Owner &&
            await readActiveOwnerCount(connection, existingAffiliation.organization.id) === 1) {
          return invalid({
            affiliation: ['Unable to remove membership. This is the sole owner for this organization.']
          });
        }

        if (!await permissions.deleteAffiliation(connection, request.session, existingAffiliation)) {
          return invalid({
            permissions: [permissions.ERROR_MESSAGE]
          });
        }

        return valid(existingAffiliation.id);
      },
      respond: crud.wrapRespond({
        valid: (async request => {
          const affiliationId = request.body;
          const dbResult = await deleteAffiliation(connection, affiliationId);
          if (isInvalid(dbResult)) {
            return basicResponse(503, request.session, makeJsonResponseBody({ database: ['Database error'] }));
          }
          return basicResponse(200, request.session, makeJsonResponseBody(dbResult.value));
        }) as (request: Request<ValidatedDeleteRequestBody, Session>) => Promise<Response<JsonResponseBody<Affiliation | DeleteValidationErrors>, Session>>,
        invalid: (async request => {
          return basicResponse(400, request.session, makeJsonResponseBody(request.body));
        }) as (request: Request<DeleteValidationErrors, Session>) => Promise<Response<JsonResponseBody<DeleteValidationErrors>, Session>>
      })
    };
  }
};

export default resource;
