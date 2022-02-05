export interface RelatedArticle {
    id: number;
    code: string;
    title: string;
    body?: unknown;
    type: number;
    catalogId?: unknown;
    catalogName?: unknown;
    publishDate?: unknown;
}

export interface Data {
    id: number;
    title: string;
    body: string;
    code: string;
    publishDate: number;
    relatedArticles: RelatedArticle[];
    articleType: number;
    firstCatalogName: string;
    firstCatalogId: number;
    secondCatalogName?: unknown;
    secondCatalogId?: unknown;
    thirdCatalogName?: unknown;
    thirdCatalogId?: unknown;
    seoTitle: string;
    seoKeywords: string;
    seoDesc: string;
    version: string;
}

export interface AnnouncementDetailAPI {
    code: string;
    message?: unknown;
    messageDetail?: unknown;
    data: Data;
    success: boolean;
}
