import { Connection, readOneAffiliationById, readOneFileById, readOneOrganization, readOneUser } from 'back-end/lib/db';
import { Affiliation, MembershipStatus } from 'shared/lib/resources/affiliation';
import { FileRecord } from 'shared/lib/resources/file';
import { Organization } from 'shared/lib/resources/organization';
import { User } from 'shared/lib/resources/user';
import { Id } from 'shared/lib/types';
import { invalid, isInvalid, valid, validateGenericString, validateUUID, Validation } from 'shared/lib/validation';

export async function validateUserId(connection: Connection, userId: Id): Promise<Validation<User>> {
  // Validate the provided id
  const validatedId = validateUUID(userId);
  if (isInvalid(validatedId)) {
    return validatedId;
  }
  const dbResult = await readOneUser(connection, userId);
  switch (dbResult.tag) {
    case 'valid':
      return dbResult.value ? valid(dbResult.value) : invalid(['This user cannot be found.']);
    case 'invalid':
      return invalid(['Please select a valid user']);
  }
}

export async function validateImageFile(connection: Connection, fileId: Id): Promise<Validation<FileRecord>> {
  try {
    // Validate the provided id
    const validatedId = validateUUID(fileId);
    if (validatedId.tag === 'invalid') {
      return validatedId;
    }
    const dbResult = await readOneFileById(connection, fileId);
    if (isInvalid(dbResult)) {
      return invalid(['Database error']);
    }
    const file = dbResult.value;
    if (file) {
      return valid(file);
    } else {
      return invalid(['The specified image file was not found.']);
    }
  } catch (e) {
    return invalid(['Please specify a valid image file id.']);
  }
}

export async function validateOrganizationId(connection: Connection, orgId: Id, allowInactive = false): Promise<Validation<Organization>> {
  try {
    // Validate the provided id
    const validatedId = validateUUID(orgId);
    if (validatedId.tag === 'invalid') {
      return validatedId;
    }
    const dbResult = await readOneOrganization(connection, orgId, allowInactive);
    if (isInvalid(dbResult)) {
      return invalid(['Database error.']);
    }
    if (!dbResult.value) {
      return invalid(['The specified organization was not found.']);
    }
    return valid(dbResult.value);
  } catch (e) {
    return invalid(['Please select a valid organization.']);
  }
}

export async function validateAffiliationId(connection: Connection, affiliationId: Id): Promise<Validation<Affiliation>> {
  try {
    // Validate the provided id
    const validatedId = validateUUID(affiliationId);
    if (validatedId.tag === 'invalid') {
      return validatedId;
    }
    const dbResult = await readOneAffiliationById(connection, affiliationId);
    if (isInvalid(dbResult)) {
      return invalid(['Database error']);
    }
    const affiliation = dbResult.value;
    if (!affiliation) {
      return invalid(['The specified affiliation was not found.']);
    } else if (affiliation.membershipStatus === MembershipStatus.Inactive) {
      return invalid(['The specified affiliation is inactive.']);
    } else {
      return valid(affiliation);
    }
  } catch (e) {
    return invalid(['Please select a valid affiliation.']);
  }
}

export function validateFilePath(path: string): Validation<string> {
  return validateGenericString(path, 'File path');
}
