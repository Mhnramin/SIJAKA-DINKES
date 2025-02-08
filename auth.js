const ss = SpreadsheetApp.getActive();
const wsUsers = ss.getSheetByName("Users");
const wsInvitations = ss.getSheetByName("Invitations");
const wsApprovals = ss.getSheetByName("Approvals");

// log in
function login(email, password) {
  let token = "invalid";
  let users;
  let invitations;
  let approvals;

  let correctPassword = getPassword(email);
  if (correctPassword) {
    if (password === correctPassword) {
      token = createToken(email);
      let data = getData();
      users = data.users;
      invitations = data.invitations;
      approvals = data.approvals;
    } else {
      token = "mismatch";
    }
  }
  return { token, users, approvals, invitations };
}

function getUsers() {
  let users = {};
  wsUsers
    .getDataRange()
    .getValues()
    .forEach((value, i) => {
      if (i) {
        let key = value[1].toString().trim().toLowerCase();
        users[key] = {
          email: key,
          role: value[2].toString().trim(),
          name: value[3].toString().trim(),
          status: value[4].toString().trim(),
          token: getToken(key),
        };
      }
    });
  return users;
}

function getInvitations() {
  let invitations = {};
  wsInvitations
    .getDataRange()
    .getValues()
    .forEach((value, i) => {
      if (i) {
        let key = value[1].toString().trim().toLowerCase();
        invitations[key] = {
          email: key,
          role: value[2].toString().trim(),
          invitation: value[3].toString().trim(),
          status: value[4].toString().trim(),
        };
      }
    });
  return invitations;
}

// Get approvals, users, and invitations form this worksheet
function getData() {
  let users = getUsers();
  let invitations = getInvitations();
  let approvals = getApprovals();
  return { users, invitations, approvals };
}

// send invitation
function sendInvitation(email, role) {
  let invitation = Math.random().toString(36).slice(5).toUpperCase();
  let status = "new";
  let rowContents = [new Date(), email, role, invitation, status];
  sendInvitationEmail(email, role, invitation);
  wsInvitations.appendRow(rowContents);
  return { email, role, invitation, status };
}

const setUp = () => {
  doInitialSetUpForTesting_([
    { name: "superadmin", email: "superadmin", role: "owner" },
  ]);
};
const setUpAndAddTestUsers = () => {
  const dummyInvitations = [
    { name: "superadmin", email: "superadmin", role: "owner" },
    { name: "Tom", email: "tom@gmail.com", role: "admin" },
    { name: "Priya", email: "priya@gmail.com", role: "standard" },
    { name: "Julie", email: "julie@gmail.com", role: "standard" },
  ];
  doInitialSetUpForTesting_(dummyInvitations);
};

const doInitialSetUpForTesting_ = (invitations) => {
  //  clear out the users and invitations sheets from 2nd row onwards
  wsUsers.getRange("A2:G").clearContent();
  wsInvitations.getRange("A2:G").clearContent();

  // Dummy invitation containing email and role

  invitations.map(({ name, role, email }) => {
    let status = "new";
    let rowContents = [new Date(), email, role, "ABCD", status];
    wsInvitations.appendRow(rowContents);
  });

  invitations.map((invitation) => {
    return addUser({
      invitation,
      role: invitation.role,
      name: invitation.name,
      email: invitation.email,
      password: "1234",
      passwordConfirmed: "1234",
    });
  });
};

function deleteInvitation(key) {
  let rows = wsInvitations.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    let email = rows[i][1].toString().trim().toLowerCase();
    if (email === key) {
      wsInvitations.deleteRow(i + 1);
      break;
    }
  }
}

// add new user to database
function addUser({
  invitation,
  role,
  name,
  email,
  password,
  passwordConfirmed,
}) {
  email = email.trim().toLowerCase();
  savePassword(email, password);
  let status = "active";
  let token = null;
  let rowContents = [new Date(), email, role, name, status];
  let user = { email, role, name, status, token };
  wsUsers.appendRow(rowContents);

  // change invitation status to inactive
  // update role in the invitations sheet
  rows = wsInvitations.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    let currentEmail = rows[i][1].toString().trim().toLowerCase();
    if (currentEmail === email) {
      wsInvitations.getRange("E" + (i + 1)).setValue("inactive");
      break;
    }
  }

  return user;
}

//delete User
function deleteUser(key) {
  // delete token
  CacheService.getScriptCache().remove(key);
  // delete password
  PropertiesService.getDocumentProperties().deleteProperty(key);
  let rows = wsUsers.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    let email = rows[i][1].toString().trim().toLowerCase();
    if (email === key) {
      wsUsers.deleteRow(i + 1);
      break;
    }
  }
}
// changeUserRole
function changeUserRole(email, role) {
  // update role in the users sheet
  let rows = wsUsers.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    let currentEmail = rows[i][1].toString().trim().toLowerCase();
    if (currentEmail === email) {
      wsUsers.getRange("C" + (i + 1)).setValue(role);
      break;
    }
  }
  // update role in the invitations sheet
  rows = wsInvitations.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    let currentEmail = rows[i][1].toString().trim().toLowerCase();
    if (currentEmail === email) {
      wsInvitations.getRange("C" + (i + 1)).setValue(role);
      break;
    }
  }
}

// change user profile
function changeUserProfile(user) {
  let email = user.email;
  let name = user.name;

  // update role in the users sheet
  let rows = wsUsers.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    let currentEmail = rows[i][1].toString().trim().toLowerCase();
    if (currentEmail === email) {
      wsUsers.getRange("D" + (i + 1)).setValue(name);
      break;
    }
  }
}

function changePassword(email, oldPassword, newPassword) {
  let currentPassword = getPassword(email);
  if (oldPassword === currentPassword) {
    savePassword(email, newPassword);
    return "Password has been changed, please login.";
  }
}

// create token
function createToken(key) {
  let token = "key-" + Utilities.getUuid() + "-afei";
  let cache = CacheService.getScriptCache();
  let expirationInSeconds = 60 * 60 * 6;
  cache.put(key, token, expirationInSeconds);
  return token;
}
// get token
function getToken(key) {
  let cache = CacheService.getScriptCache();
  let token = cache.get(key);
  return token;
}

// save password
function savePassword(key, password) {
  let encodedPassword = encodePassword(password);
  let props = PropertiesService.getDocumentProperties();
  props.setProperty(key, encodedPassword);
}

// get password from document properties
function getPassword(key) {
  let props = PropertiesService.getDocumentProperties();
  let password = props.getProperty(key);
  if (password) {
    password = decodePassword(password);
  }
  return password;
}

// encode password
function encodePassword(password) {
  let encoded = Utilities.base64Encode(password);
  return encoded;
}

// decode password
function decodePassword(encoded) {
  let data = Utilities.base64Decode(encoded);
  let decoded = Utilities.newBlob(data).getDataAsString();
  return decoded;
}

//send invitation email
function sendInvitationEmail(email, role, code) {
  let subject = "Invitation for Signup";
  let body = "";
  let url = getPageUrl();
  let htmlBody = `<table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="auto"><\/td>
      <td width="600px" style="padding: 24px; background: #eee;">
          <h1>Invitation<\/h1>
          <p>You were invited as the <b>${role}<\/b> user, please <a href="${url}" style="color: #4DB6AC">
              sign up<\/a> with your email and the below invitation code.<\/p>
          
          <p style="margin: 13px 0px; 
              text-align:center; 
              background: #4DB6AC; 
              letter-spacing: 24px;  
              padding: 24px; 
              font-size: 70px;
              font-weight: bold;
              color: #fff;">${code}<\/p>
          
          <p>Thanks & BR,<br>Approval Workflow Team<\/p>
      <\/td>
      <td width="auto"><\/td><\/table>`;
  let options = {
    htmlBody,
  };
  GmailApp.sendEmail(email, subject, body, options);
}

function render(page, title, data) {
  const template = HtmlService.createTemplateFromFile(page);
  template.data = data;
  let html = template
    .evaluate()
    .setTitle(title)
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

// add new approval to database
function createApproval({
  uuid,
  title,
  description,
  assignTo,
  createdBy,
  files,
  status,
  comments,
}) {
  uuid = Utilities.getUuid();
  status = "pending";
  files = createFiles(files);
  let rowContents = [
    new Date(),
    uuid,
    title,
    description,
    assignTo,
    createdBy,
    files.join("\n"),
    status,
    comments,
  ];
  wsApprovals.appendRow(rowContents);

  let approval = {
    uuid,
    title,
    description,
    assignTo,
    createdBy,
    files,
    status,
    comments,
  };
  sendApprovalChangeNotification(approval);

  return approval;
}

function getApproval(uuid, email) {
  let approvals = getApprovals();
  let approval = approvals[uuid];
  if (approval) {
    if (approval.assignTo === email) {
      if (approval.status === "pending") {
        return {
          status: "success",
          approval: approval,
        };
      } else {
        return {
          status: "Closed approval",
          message: `Approval status: [${approval.status}].`,
        };
      }
    } else {
      return {
        status: "Error",
        message: `Invalid query, [${email}] is not the correct person to approve this request.`,
      };
    }
  } else {
    return {
      status: "Error",
      message: `Invalid query, approval uuid [${uuid}] was not found in the database.`,
    };
  }
}

function getApprovals() {
  let approvals = {};
  wsApprovals
    .getDataRange()
    .getValues()
    .forEach((value, i) => {
      if (i) {
        let key = value[1].toString().trim().toLowerCase();

        let files = value[6].toString().trim();
        if (files === "") {
          files = [];
        } else {
          files = value[6].toString().trim().split("\n");
        }
        approvals[key] = {
          uuid: key,
          title: value[2].toString().trim(),
          description: value[3].toString().trim(),
          assignTo: value[4].toString().trim().toLowerCase(),
          createdBy: value[5].toString().trim().toLowerCase(),
          files: files,
          status: value[7].toString().trim().toLowerCase(),
          comments: value[8].toString().trim().toLowerCase(),
        };
      }
    });
  return approvals;
}
function sendApprovalChangeNotification(approval) {
  let url = getPageUrl();
  url = `${url}?p=api&uuid=${approval.uuid}&email=${approval.assignTo}`;

  let recipient = approval.assignTo;
  let subject = `${approval.status} approval - ${approval.title}`;
  let body = "";
  let htmlBody = `<table cellpadding="0" cellspacing="0"><tr><td width="auto"><\/td><td>`;

  if (approval.status === "pending") {
    htmlBody += `<p>Your action is required for this approval request.<\/p>`;
    htmlBody += `<p><a href="${url}" target="_blank" style="padding: 6px 12px; background: #26A69A; color: #fff;">Action<\/a><\/p>`;
  } else {
    recipient = [approval.createdBy, approval.assignTo].join(",");
    htmlBody += `<p>This approval request is now closed.<\/p>`;
  }

  htmlBody += `<p><table>
        <tr><td style="border-bottom: 1px solid #eee; padding: 6px 12px;">Status<\/td>
            <td style="border-bottom: 1px solid #eee; padding: 6px 12px; 
                color: ${
                  approval.status === "rejected"
                    ? "red"
                    : approval.status === "approved"
                    ? "green"
                    : "#f9a825"
                };">${approval.status}<\/td><\/tr>
        <tr><td style="border-bottom: 1px solid #eee; padding: 6px 12px;">Title<\/td>
            <td style="border-bottom: 1px solid #eee; padding: 6px 12px;">${
              approval.title
            }<\/td><\/tr>
        <tr><td style="border-bottom: 1px solid #eee; padding: 6px 12px;">Description<\/td>
            <td style="border-bottom: 1px solid #eee; padding: 6px 12px;">${
              approval.description
            }<\/td><\/tr>
        <tr><td style="border-bottom: 1px solid #eee; padding: 6px 12px;">Assign to<\/td>
            <td style="border-bottom: 1px solid #eee; padding: 6px 12px;">${
              approval.assignTo
            }<\/td><\/tr>
        <tr><td style="border-bottom: 1px solid #eee; padding: 6px 12px;">Created by<\/td>
            <td style="border-bottom: 1px solid #eee; padding: 6px 12px;">${
              approval.createdBy
            }<\/td><\/tr>
        <tr><td style="border-bottom: 1px solid #eee; padding: 6px 12px;">Comments<\/td>
            <td style="border-bottom: 1px solid #eee; padding: 6px 12px;">${
              approval.comments
            }<\/td><\/tr>
        <\/table><\/p>`;

  htmlBody += `<p>Approval Workflow Team<\/p>`;

  htmlBody += `<\/td><td width="auto"><\/td><\/tr><\/table>`;
  let options = {
    htmlBody,
  };
  GmailApp.sendEmail(recipient, subject, body, options);
}

function changeApprovalStatus(email, uuid, status, comments) {
  let rows = wsApprovals.getDataRange().getValues();
  let approval;
  for (let i = 0; i < rows.length; i++) {
    let thisUuid = wsApprovals
      .getRange("B" + (i + 1))
      .getValue()
      .toString()
      .trim();
    if (uuid === thisUuid) {
      // change assign to email
      if (email) {
        wsApprovals
          .getRange("E" + (i + 1))
          .setValue(email.trim().toLowerCase());
      }

      // change status
      wsApprovals.getRange("H" + (i + 1)).setValue(status);

      // change comments
      let thisComments = wsApprovals
        .getRange("I" + (i + 1))
        .getValue()
        .toString()
        .trim();
      if (thisComments) {
        comments = [thisComments, comments].join("<br>");
      }

      wsApprovals.getRange("I" + (i + 1)).setValue(comments);

      let value = wsApprovals.getDataRange().getValues()[i];
      let files = value[6].toString().trim();
      if (files === "") {
        files = [];
      } else {
        files = value[6].toString().trim().split("\n");
      }
      approval = {
        uuid: uuid,
        title: value[2].toString().trim(),
        description: value[3].toString().trim(),
        assignTo: value[4].toString().trim().toLowerCase(),
        createdBy: value[5].toString().trim().toLowerCase(),
        files: files,
        status: status,
        comments: comments,
      };
      // send approval
      sendApprovalChangeNotification(approval);
      break;
    }
  }
  return approval;
}
function cancelApproval(key) {
  let rows = wsApprovals.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    let uuid = rows[i][1].toString().trim();
    if (uuid === key) {
      wsApprovals.deleteRow(i + 1);
      break;
    }
  }
}

function createFiles(files) {
  let folder = getFolderByName("Uploads");
  files = files.map((file) => {
    let newFile = createFile(file, folder);
    let accessType = DriveApp.Access.ANYONE;
    let permissionType = DriveApp.Permission.VIEW;
    newFile.setSharing(accessType, permissionType).getUrl();
    return `<a href="${newFile.getUrl()}" target="_blank">${newFile.getName()}<\/a>`;
  });
  return files;
}
