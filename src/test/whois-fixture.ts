import type { WhoisHistoryResponse, WhoisResponse } from "@/types/whois";

export const whoisFixture: WhoisResponse = {
  domain: "acme.com",
  whois: {
    data: {
      created_date: "2017-01-11T00:00:00Z",
      updated_date: "2025-12-02T00:00:00Z",
      expires_date: "2027-01-11T00:00:00Z",
      age_days: 3571,
      age_years: 9.8,
      age_verdict: { level: "established", label: "Domain lâu năm (trên 3 năm)" },
      registrar: "GoDaddy.com, LLC",
      status: ["clientTransferProhibited", "clientDeleteProhibited"],
      name_servers: ["ns1.acme.com", "ns2.acme.com"],
      registrant_organization: "Domains By Proxy, LLC",
      privacy_protected: true,
    },
    error: null,
  },
};

export const whoisHistoryFixture: WhoisHistoryResponse = {
  domain: "acme.com",
  history: {
    data: {
      summary: {
        records: 5,
        first_seen: "2018-03-02T00:00:00Z",
        changes_total: 3,
        registrar_changes: 1,
        nameserver_changes: 1,
        registrant_changes: 1,
        expiry_changes: 0,
      },
      events: [
        {
          date: "2024-06-10T00:00:00Z",
          field: "registrant",
          from: null,
          to: "Domains By Proxy, LLC",
        },
        {
          date: "2021-09-15T00:00:00Z",
          field: "name_servers",
          from: "ns1.old-host.net, ns2.old-host.net",
          to: "ns1.acme.com, ns2.acme.com",
        },
        {
          date: "2019-04-20T00:00:00Z",
          field: "registrar",
          from: "Namecheap, Inc.",
          to: "GoDaddy.com, LLC",
        },
      ],
      events_truncated: false,
    },
    error: null,
  },
};
