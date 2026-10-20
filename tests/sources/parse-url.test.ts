import { describe, expect, it } from "vitest";
import { parseSourceUrl, type ParseResult } from "@/modules/sources/parse-url";

function ok(result: ParseResult) {
  if (!result.ok) throw new Error(`Expected success, got: ${result.error}`);
  return result.source;
}

function error(result: ParseResult) {
  if (result.ok) throw new Error(`Expected an error, got: ${result.source.key}`);
  return result.error;
}

describe("parseSourceUrl — exemples de la spec", () => {
  it("reconnaît un compte Instagram", () => {
    expect(ok(parseSourceUrl("instagram.com/mouthwash.studio"))).toEqual({
      type: "instagram",
      displayName: "@mouthwash.studio",
      url: "https://www.instagram.com/mouthwash.studio",
      key: "instagram:mouthwash.studio",
    });
  });

  it("reconnaît un compte X", () => {
    expect(ok(parseSourceUrl("https://x.com/studiobakers"))).toEqual({
      type: "x",
      displayName: "@studiobakers",
      url: "https://x.com/studiobakers",
      key: "x:studiobakers",
    });
  });

  it("reconnaît un site web", () => {
    expect(ok(parseSourceUrl("the-brandidentity.com/features"))).toEqual({
      type: "web",
      displayName: "the-brandidentity.com/features",
      url: "https://the-brandidentity.com/features",
      key: "web:the-brandidentity.com/features",
    });
  });

  it("reconnaît une page entreprise LinkedIn", () => {
    expect(ok(parseSourceUrl("https://www.linkedin.com/company/pentagram/"))).toEqual({
      type: "linkedin",
      displayName: "pentagram",
      url: "https://www.linkedin.com/company/pentagram",
      key: "linkedin:company/pentagram",
    });
  });

  it("reconnaît un profil LinkedIn personnel", () => {
    expect(ok(parseSourceUrl("fr.linkedin.com/in/jane-doe")).key).toBe("linkedin:in/jane-doe");
  });
});

describe("parseSourceUrl — YouTube", () => {
  it("reconnaît une chaîne par son @nom", () => {
    expect(ok(parseSourceUrl("https://www.youtube.com/@itsnicethat"))).toEqual({
      type: "youtube",
      displayName: "@itsnicethat",
      url: "https://www.youtube.com/@itsnicethat",
      key: "youtube:@itsnicethat",
    });
  });

  it("même chaîne écrite différemment (majuscules, m., sous-page vidéos)", () => {
    expect(ok(parseSourceUrl("m.youtube.com/@ItsNiceThat/videos?si=abc")).key).toBe("youtube:@itsnicethat");
  });

  it("reconnaît les anciennes adresses de chaîne", () => {
    expect(ok(parseSourceUrl("https://www.youtube.com/channel/UChPo_E4H5QTm-OXBALKerXw")).key).toBe(
      "youtube:channel/UChPo_E4H5QTm-OXBALKerXw",
    );
    expect(ok(parseSourceUrl("youtube.com/c/Pentagram")).key).toBe("youtube:c/pentagram");
    expect(ok(parseSourceUrl("youtube.com/user/pentagram")).key).toBe("youtube:user/pentagram");
  });

  it("refuse un lien de vidéo ou de playlist", () => {
    expect(error(parseSourceUrl("https://www.youtube.com/watch?v=n5PkNF61z9w"))).toMatch(/chaîne/i);
    expect(error(parseSourceUrl("https://youtu.be/n5PkNF61z9w"))).toMatch(/chaîne/i);
    expect(error(parseSourceUrl("youtube.com/shorts/abc"))).toMatch(/chaîne/i);
  });
});

describe("parseSourceUrl — même source écrite différemment", () => {
  it("Instagram : www, paramètres, slash final et majuscules ignorés", () => {
    const a = ok(parseSourceUrl("https://www.instagram.com/mouthwash.studio/?hl=fr"));
    const b = ok(parseSourceUrl("instagram.com/mouthwash.studio"));
    const c = ok(parseSourceUrl("  HTTPS://Instagram.com/Mouthwash.Studio?igsh=abc123  "));
    expect(a.key).toBe(b.key);
    expect(c.key).toBe(b.key);
  });

  it("X : twitter.com et x.com désignent la même source", () => {
    const a = ok(parseSourceUrl("twitter.com/StudioBakers"));
    expect(a.key).toBe("x:studiobakers");
    expect(a.url).toBe("https://x.com/StudioBakers");
  });

  it("X : un lien vers un post renvoie au compte", () => {
    expect(ok(parseSourceUrl("https://x.com/studiobakers/status/123456")).key).toBe("x:studiobakers");
  });

  it("Web : www, majuscules du domaine, slash final, ancre et paramètres de suivi ignorés", () => {
    const a = ok(parseSourceUrl("https://WWW.The-BrandIdentity.com/features/?utm_source=ig&utm_medium=social#top"));
    const b = ok(parseSourceUrl("the-brandidentity.com/features"));
    expect(a.key).toBe(b.key);
  });

  it("Web : les paramètres utiles sont conservés, dans un ordre stable", () => {
    const a = ok(parseSourceUrl("example.com/blog?tag=design&page=2"));
    const b = ok(parseSourceUrl("example.com/blog?page=2&tag=design&fbclid=xyz"));
    expect(a.key).toBe("web:example.com/blog?page=2&tag=design");
    expect(b.key).toBe(a.key);
  });

  it("Web : la page d'accueil n'a pas de chemin dans la clé", () => {
    expect(ok(parseSourceUrl("https://www.itsnicethat.com/")).key).toBe("web:itsnicethat.com");
  });

  it("Web : un port non standard est conservé", () => {
    expect(ok(parseSourceUrl("http://example.com:8080/blog"))).toMatchObject({
      url: "http://example.com:8080/blog",
      key: "web:example.com:8080/blog",
    });
    expect(ok(parseSourceUrl("https://example.com:443/blog")).key).toBe("web:example.com/blog");
  });

  it("Web : http est conservé dans l'adresse mais pas dans la clé", () => {
    const source = ok(parseSourceUrl("http://example.com/news"));
    expect(source.url).toBe("http://example.com/news");
    expect(source.key).toBe("web:example.com/news");
  });
});

describe("parseSourceUrl — erreurs", () => {
  it("refuse une adresse vide", () => {
    expect(error(parseSourceUrl("   "))).toMatch(/collez/i);
  });

  it("refuse un texte qui n'est pas une adresse", () => {
    expect(error(parseSourceUrl("bonjour"))).toMatch(/pas une adresse valide/i);
    expect(error(parseSourceUrl("hello world.com"))).toMatch(/pas une adresse valide/i);
  });

  it("refuse les protocoles autres que http(s)", () => {
    expect(error(parseSourceUrl("ftp://example.com"))).toMatch(/pas une adresse valide/i);
  });

  it("refuse une publication Instagram (pas un compte)", () => {
    expect(error(parseSourceUrl("instagram.com/p/xyz"))).toMatch(/profil/i);
    expect(error(parseSourceUrl("https://www.instagram.com/reel/abc/"))).toMatch(/profil/i);
  });

  it("refuse une page X qui n'est pas un compte", () => {
    expect(error(parseSourceUrl("x.com/home"))).toMatch(/profil/i);
    expect(error(parseSourceUrl("https://x.com/search?q=design"))).toMatch(/profil/i);
  });

  it("refuse un réseau social sans nom de compte", () => {
    expect(error(parseSourceUrl("instagram.com"))).toMatch(/profil/i);
    expect(error(parseSourceUrl("https://x.com/"))).toMatch(/profil/i);
  });

  it("refuse une page LinkedIn qui n'est pas une entreprise ou un profil", () => {
    expect(error(parseSourceUrl("linkedin.com/feed/"))).toMatch(/profil/i);
  });
});
